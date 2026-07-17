import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";
import { recalculateFundingStanding } from "@/lib/funding-standing";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = text(body.reason, 1800);
  if (reason.length < 80) return NextResponse.json({ error: "Explain the evidence and reason for the appeal in at least 80 characters." }, { status: 400 });
  const submission = await db.courseSubmission.findFirst({ where: { id, studentId: user.id } });
  if (!submission || !["REVISION_REQUIRED", "DECLINED", "AI_EXCEPTION"].includes(submission.status)) return NextResponse.json({ error: "This submission is not eligible for appeal." }, { status: 409 });
  const existing = await db.submissionAppeal.findFirst({ where: { submissionId: id, studentId: user.id } });
  if (existing) return NextResponse.json({ error: "One appeal is already recorded for this submission." }, { status: 409 });
  const appeal = await db.submissionAppeal.create({ data: { submissionId: id, studentId: user.id, reason } });
  await db.courseSubmission.update({ where: { id }, data: { status: "APPEALED" } });
  await recalculateFundingStanding(user.id);
  return NextResponse.json({ appeal }, { status: 201 });
}
