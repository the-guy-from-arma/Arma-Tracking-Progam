import { FundingAwardType, FundingCapability } from "@prisma/client";
import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fundingAccount, hasFundingCapability, issueFundingAward, mutateFundingAward, requireFundingCapability } from "@/lib/funding-awards";
import { text } from "@/lib/input";

export async function GET(request: Request) {
  const actor = await currentUser(); if (!actor || !isAdmin(actor.role)) return NextResponse.json({ error: "Administrative authority required." }, { status: 403 });
  await requireFundingCapability(actor, "VIEW"); const q = new URL(request.url).searchParams; const studentId = text(q.get("studentId"), 100);
  if (!studentId) {
    const [students, staff] = await Promise.all([
      db.user.findMany({ where: { isStudent: true }, select: { id: true, name: true, studentNumber: true, grantBalanceCents: true }, orderBy: { name: "asc" }, take: 300 }),
      actor.role === "OWNER" ? db.user.findMany({ where: { role: { in: ["ADMIN", "FACULTY"] }, suspended: false }, select: { id: true, name: true, role: true, academicEmail: true, fundingPermissions: { select: { capability: true } } }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    ]);
    const permissions = actor.role === "OWNER" ? [...(["VIEW", "NOTE", "ISSUE", "EDIT_DETAILS", "ADJUST", "REVERSE_UNUSED", "SUSPEND"] as FundingCapability[])] : (await db.fundingPermission.findMany({ where: { userId: actor.id }, select: { capability: true } })).map((item) => item.capability).concat(actor.role === "ADMIN" ? ["VIEW", "NOTE"] : []);
    return NextResponse.json({ students, permissions: [...new Set(permissions)], staff, canManagePermissions: actor.role === "OWNER" });
  }
  return NextResponse.json(await fundingAccount(studentId, true));
}

export async function POST(request: Request) {
  const actor = await currentUser(); if (!actor || !isAdmin(actor.role)) return NextResponse.json({ error: "Administrative authority required." }, { status: 403 });
  const body = await request.json().catch(() => ({})); const action = String(body.action || "ISSUE");
  try {
    if (action === "ISSUE") {
      const type = Object.values(FundingAwardType).includes(body.type) ? body.type : FundingAwardType.INTERNAL_GRANT;
      const award = await issueFundingAward(actor, { userId: text(body.userId, 100), type, sourceName: text(body.sourceName, 140), amountCents: Math.round(Number(body.amountCents)), expiresAt: body.expiresAt ? new Date(body.expiresAt) : null, publicDescription: text(body.publicDescription, 500), restrictions: text(body.restrictions, 500), issuingDepartment: text(body.issuingDepartment, 140), reason: text(body.reason, 80), internalNote: text(body.internalNote, 1000) || null, idempotencyKey: text(body.idempotencyKey, 160) });
      return NextResponse.json({ award }, { status: 201 });
    }
    const award = await mutateFundingAward(actor, text(body.awardId, 100), action as "ADJUST" | "SUSPEND" | "RESUME" | "REVERSE_UNUSED" | "NOTE", { amountCents: body.amountCents == null ? undefined : Math.round(Number(body.amountCents)), reason: text(body.reason, 80), publicReason: text(body.publicReason, 500), internalNote: text(body.internalNote, 1000) || null, idempotencyKey: text(body.idempotencyKey, 160) });
    return NextResponse.json({ award });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Funding action failed." }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  const owner = await currentUser(); if (!owner || owner.role !== "OWNER") return NextResponse.json({ error: "Owner authority required." }, { status: 403 });
  const body = await request.json().catch(() => ({})); const userId = text(body.userId, 100); const capability = String(body.capability) as FundingCapability;
  if (!Object.values(FundingCapability).includes(capability)) return NextResponse.json({ error: "Unknown funding capability." }, { status: 400 });
  if (body.granted === false) await db.fundingPermission.deleteMany({ where: { userId, capability } });
  else await db.fundingPermission.upsert({ where: { userId_capability: { userId, capability } }, update: { grantedById: owner.id }, create: { userId, capability, grantedById: owner.id } });
  await db.auditLog.create({ data: { actorId: owner.id, action: body.granted === false ? "FUNDING_PERMISSION_REVOKED" : "FUNDING_PERMISSION_GRANTED", entity: "User", entityId: userId, detail: { capability } } });
  return NextResponse.json({ ok: true, granted: await hasFundingCapability({ id: userId, role: "TRAINEE" }, capability) });
}
