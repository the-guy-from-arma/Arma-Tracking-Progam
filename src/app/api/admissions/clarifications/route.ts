import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { admissionReviewTiming } from "@/lib/admissions-automation";
import { trackingEvent } from "@/lib/application-tracking";
import { db } from "@/lib/db";
import { text } from "@/lib/input";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const clarificationId = text(body.clarificationId, 100);
  const answers = Array.isArray(body.answers) ? body.answers.map((answer: unknown) => text(answer, 1600)) : [];
  const clarification = await db.admissionClarification.findFirst({ where: { id: clarificationId, applicantId: user.id }, include: { application: true } });
  if (!clarification) return NextResponse.json({ error: "Clarification request not found." }, { status: 404 });
  if (clarification.submittedAt) return NextResponse.json({ ok: true, idempotentReplay: true });
  const questions = Array.isArray(clarification.questions) ? clarification.questions : [];
  if (answers.length !== questions.length || answers.some((answer: string) => answer.length < 20)) return NextResponse.json({ error: "Answer every question with enough detail for the review to continue." }, { status: 400 });
  const reviewTiming = admissionReviewTiming({
    workbenchExperience: clarification.application.workbenchExperience,
    enforceExperience: clarification.application.enforceExperience,
    learningGoals: clarification.application.learningGoals,
    fundingStatement: clarification.application.fundingStatement,
    clarificationResponses: [answers],
  });
  await db.$transaction(async (tx) => {
    await tx.admissionClarification.update({ where: { id: clarification.id }, data: { response: answers, submittedAt: new Date() } });
    await tx.studentApplication.update({ where: { id: clarification.applicationId }, data: { status: "UNDER_AUTOMATED_REVIEW" } });
    await tx.admissionReviewJob.upsert({
      where: { idempotencyKey: `admission-review:${clarification.applicationId}:r${clarification.round}` },
      update: { status: "QUEUED", stage: "APPLICATION_RECEIVED", availableAt: reviewTiming.availableAt, lockedAt: null, heartbeatAt: null, lastError: null },
      create: { applicationId: clarification.applicationId, clarificationRound: clarification.round, idempotencyKey: `admission-review:${clarification.applicationId}:r${clarification.round}`, availableAt: reviewTiming.availableAt, maxAttempts: Number(process.env.ADMISSIONS_MAX_RETRIES || 3) },
    });
    const tracker = await tx.applicationTracking.findFirstOrThrow({ where: { studentApplicationId: clarification.applicationId } });
    const history = Array.isArray(tracker.statusHistory) ? tracker.statusHistory : [];
    await tx.applicationTracking.update({ where: { id: tracker.id }, data: { status: "IN_REVIEW", statusHistory: [...history, trackingEvent("CLARIFICATION_SUBMITTED", `Applicant completed clarification round ${clarification.round}`), trackingEvent("UNDER_AUTOMATED_REVIEW", "Admissions review resumed")] } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "ADMISSION_CLARIFICATION_SUBMITTED", entity: "AdmissionClarification", entityId: clarification.id, detail: { applicationId: clarification.applicationId, round: clarification.round, reviewMethod: "CHARACTER_COUNT_DURATION", characterCount: reviewTiming.characterCount, reviewAvailableAt: reviewTiming.availableAt } } });
  });
  return NextResponse.json({ ok: true, status: "UNDER_AUTOMATED_REVIEW" }, { status: 202 });
}
