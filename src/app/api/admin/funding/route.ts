import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { activeWithdrawalPolicy, DEFAULT_POLICY } from "@/lib/funding-standing";
import { db } from "@/lib/db";
import { text } from "@/lib/input";

export async function GET(request: Request) {
  const user = await currentUser(); if (!user || !isAdmin(user.role)) return NextResponse.json({ error: "Administrative authority required." }, { status: 403 });
  const q = new URL(request.url).searchParams; const page = Math.max(1, Number(q.get("page") || 1)); const take = 25;
  const student = text(q.get("student"), 120); const type = text(q.get("type"), 40); const courseId = text(q.get("courseId"), 100);
  const from = q.get("from") ? new Date(q.get("from")!) : null; const to = q.get("to") ? new Date(`${q.get("to")}T23:59:59.999Z`) : null;
  const where = { ...(student ? { user: { OR: [{ name: { contains: student, mode: "insensitive" as const } }, { studentNumber: { contains: student, mode: "insensitive" as const } }] } } : {}), ...(type && type !== "ALL" ? { type: type as never } : {}), ...(courseId ? { courseId } : {}), ...(from || to ? { createdAt: { ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}), ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}) } } : {}) };
  const [items, total, courses, policy] = await Promise.all([
    db.grantLedger.findMany({ where, include: { user: { select: { name: true, studentNumber: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
    db.grantLedger.count({ where }), db.course.findMany({ select: { id: true, code: true, title: true }, orderBy: { code: "asc" } }), activeWithdrawalPolicy(),
  ]);
  return NextResponse.json({ items, total, page, pages: Math.max(1, Math.ceil(total / take)), courses, policy });
}

export async function PATCH(request: Request) {
  const user = await currentUser(); if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Owner authority required." }, { status: 403 });
  const body = await request.json().catch(() => ({})); const name = text(body.name, 140);
  const timeTiers = Array.isArray(body.timeTiers) ? body.timeTiers : DEFAULT_POLICY.timeTiers; const progressTiers = Array.isArray(body.progressTiers) ? body.progressTiers : DEFAULT_POLICY.progressTiers; const penaltyTiers = Array.isArray(body.penaltyTiers) ? body.penaltyTiers : DEFAULT_POLICY.penaltyTiers;
  if (name.length < 5) return NextResponse.json({ error: "Name the effective withdrawal policy." }, { status: 400 });
  const policy = await db.withdrawalPolicy.create({ data: { name, effectiveFrom: new Date(), timeTiers, progressTiers, penaltyTiers, createdById: user.id } });
  await db.auditLog.create({ data: { actorId: user.id, action: "WITHDRAWAL_POLICY_PUBLISHED", entity: "WithdrawalPolicy", entityId: policy.id, detail: { name, timeTiers, progressTiers, penaltyTiers } } });
  return NextResponse.json({ policy });
}
