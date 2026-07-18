import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createFundingReminders } from "@/lib/funding";
import { fundingAccount } from "@/lib/funding-awards";
import { policyGateResponse } from "@/lib/policies";

export async function GET() {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const gate = await policyGateResponse(user.id); if (gate) return gate;
  const term = await createFundingReminders(user.id);
  const [account, terms] = await Promise.all([
    fundingAccount(user.id),
    db.studentFundingTerm.findMany({ where: { userId: user.id }, include: { program: { select: { title: true, code: true } }, plannedCourses: { include: { course: { select: { code: true, title: true, serviceValueCents: true } } }, orderBy: { sequence: "asc" } } }, orderBy: { startsAt: "desc" }, take: 8 }),
  ]);
  return NextResponse.json({ ...account, activeTermId: term.id, terms, studentResponsibilityCents: 0, paymentStatus: "NO_PAYMENT_REQUIRED", nonCash: true });
}
