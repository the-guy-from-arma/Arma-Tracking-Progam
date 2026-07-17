import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createFundingReminders } from "@/lib/funding";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const term = await createFundingReminders(user.id);
  const [account, ledger, terms] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { grantBalanceCents: true } }),
    db.grantLedger.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.studentFundingTerm.findMany({ where: { userId: user.id }, include: { program: { select: { title: true, code: true } }, plannedCourses: { include: { course: { select: { code: true, title: true, serviceValueCents: true } } }, orderBy: { sequence: "asc" } } }, orderBy: { startsAt: "desc" }, take: 8 }),
  ]);
  return NextResponse.json({ balanceCents: account.grantBalanceCents, activeTermId: term.id, ledger, terms, studentResponsibilityCents: 0, nonCash: true });
}
