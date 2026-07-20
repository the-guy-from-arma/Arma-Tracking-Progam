import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import {
  admissionReviewTiming,
  finalizeAdmission,
} from "@/lib/admissions-automation";
import { trackingEvent } from "@/lib/application-tracking";
import { db } from "@/lib/db";
import { text } from "@/lib/input";

async function owner() {
  const user = await currentUser();
  return user?.role === "OWNER" ? user : null;
}

export async function GET() {
  const user = await owner();
  if (!user) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const staleBefore = new Date(Date.now() - 5 * 60_000);
  const [applications, queued, processing, exceptions, stale] = await Promise.all([
    db.studentApplication.findMany({
      where: { status: { in: ["SUBMITTED", "GUARDIAN_CONSENT_REQUIRED", "UNDER_AUTOMATED_REVIEW", "CLARIFICATION_REQUIRED", "AUTOMATION_EXCEPTION"] } },
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true } },
        trackingRecords: { orderBy: { createdAt: "desc" }, take: 1 },
        clarifications: { orderBy: { round: "desc" } },
        reviewJobs: { include: { decision: true }, orderBy: { createdAt: "desc" }, take: 3 },
        guardianConsent: true,
      },
      orderBy: { submittedAt: "asc" },
      take: 100,
    }),
    db.admissionReviewJob.count({ where: { status: "QUEUED" } }),
    db.admissionReviewJob.count({ where: { status: "PROCESSING" } }),
    db.admissionReviewJob.count({ where: { status: "EXCEPTION" } }),
    db.admissionReviewJob.count({ where: { status: "PROCESSING", lockedAt: { lt: staleBefore } } }),
  ]);
  return NextResponse.json({
    applications,
    worker: {
      enabled: process.env.ADMISSIONS_AUTOMATION_ENABLED === "true",
      engine: "DETERMINISTIC CHARACTER-DURATION",
      secretConfigured: Boolean(process.env.ADMISSIONS_WORKER_SECRET),
      queued, processing, exceptions, stale,
    },
  });
}

export async function PATCH(request: Request) {
  const user = await owner();
  if (!user) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const applicationId = text(body.applicationId, 100);
  const action = text(body.action, 40);
  const note = text(body.note, 1000);
  const application = await db.studentApplication.findUnique({ where: { id: applicationId }, include: { user: true } });
  if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  if (action === "verify_guardian_alternative") {
    if (note.length < 20) return NextResponse.json({ error: "Record the alternative evidence reviewed and why it establishes adult guardian authority." }, { status: 400 });
    const guardian = await db.guardianConsent.findUnique({ where: { applicationId: application.id } });
    if (!guardian || guardian.status !== "ALTERNATIVE_REVIEW") return NextResponse.json({ error: "No alternative guardian verification request is open." }, { status: 409 });
    const tracker = await db.applicationTracking.findFirst({ where: { studentApplicationId: application.id }, orderBy: { createdAt: "desc" } });
    await db.$transaction(async (tx) => {
      await tx.guardianConsent.update({ where: { id: guardian.id }, data: { status: "VERIFIED", verificationMethod: "ALTERNATIVE_REVIEW", adultVerified: true, nameMatched: true, verifiedAt: new Date(), reviewedById: user.id, reviewedAt: new Date(), providerStatus: "owner_verified_alternative", providerFailureCode: null } });
      await tx.studentApplication.update({ where: { id: application.id }, data: { status: "UNDER_AUTOMATED_REVIEW" } });
      await tx.admissionReviewJob.updateMany({ where: { applicationId: application.id, status: "WAITING_FOR_GUARDIAN" }, data: { status: "QUEUED", stage: "IDENTITY_ELIGIBILITY", availableAt: new Date(), lockedAt: null, heartbeatAt: null, lastError: null } });
      if (tracker) await tx.applicationTracking.update({ where: { id: tracker.id }, data: { statusHistory: [...(Array.isArray(tracker.statusHistory) ? tracker.statusHistory : []), trackingEvent("GUARDIAN_VERIFIED", "Owner completed documented alternative adult guardian verification")] } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "GUARDIAN_ALTERNATIVE_VERIFICATION_APPROVED", entity: "GuardianConsent", entityId: guardian.id, detail: { note } } });
    });
    return NextResponse.json({ status: "UNDER_AUTOMATED_REVIEW" }, { status: 202 });
  }

  if (action === "admit") {
    if (note.length < 5) return NextResponse.json({ error: "Record a brief override reason." }, { status: 400 });
    let result;
    try { result = await finalizeAdmission(application.id, user.id); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Admission could not be finalized." }, { status: 409 }); }
    await db.auditLog.create({ data: { actorId: user.id, action: "ADMISSION_OWNER_ADMIT_OVERRIDE", entity: "StudentApplication", entityId: application.id, detail: { note } } });
    return NextResponse.json(result);
  }

  if (action === "retry") {
    const round = await db.admissionClarification.count({ where: { applicationId: application.id, submittedAt: { not: null } } });
    const reviewTiming = admissionReviewTiming(application);
    const job = await db.admissionReviewJob.create({ data: { applicationId: application.id, clarificationRound: round, idempotencyKey: `admission-review:${application.id}:owner:${Date.now()}`, availableAt: reviewTiming.availableAt, maxAttempts: Number(process.env.ADMISSIONS_MAX_RETRIES || 3) } });
    await db.studentApplication.update({ where: { id: application.id }, data: { status: "UNDER_AUTOMATED_REVIEW" } });
    await db.auditLog.create({ data: { actorId: user.id, action: "ADMISSION_REVIEW_RETRIED", entity: "AdmissionReviewJob", entityId: job.id, detail: { applicationId: application.id, note, reviewMethod: "CHARACTER_COUNT_DURATION", characterCount: reviewTiming.characterCount, reviewAvailableAt: reviewTiming.availableAt } } });
    return NextResponse.json({ job }, { status: 202 });
  }

  if (action === "clarify") {
    const questions = Array.isArray(body.questions) ? body.questions.map((question: unknown) => text(question, 500)).filter((question: string) => question.length >= 8).slice(0, 3) : [];
    if (!questions.length) return NextResponse.json({ error: "Add at least one focused clarification question." }, { status: 400 });
    const latest = await db.admissionClarification.findFirst({ where: { applicationId: application.id }, orderBy: { round: "desc" } });
    const round = (latest?.round || 0) + 1;
    await db.$transaction([
      db.admissionClarification.create({ data: { applicationId: application.id, applicantId: application.userId, round, questions } }),
      db.studentApplication.update({ where: { id: application.id }, data: { status: "CLARIFICATION_REQUIRED" } }),
      db.notification.create({ data: { userId: application.userId, type: "ACADEMIC", title: "Admissions needs a little more information", body: "Your application is preserved. Answer the focused clarification request to continue.", actionUrl: "/admissions/status", dedupeKey: `admission-owner-clarification:${application.id}:${round}` } }),
      db.auditLog.create({ data: { actorId: user.id, action: "ADMISSION_CLARIFICATION_REQUESTED", entity: "StudentApplication", entityId: application.id, detail: { questions, note, round } } }),
    ]);
    return NextResponse.json({ status: "CLARIFICATION_REQUIRED", round });
  }

  if (action === "decline") {
    if (note.length < 20) return NextResponse.json({ error: "A detailed owner decision reason is required. Automated review alone cannot decline an applicant." }, { status: 400 });
    await db.$transaction(async (tx) => {
      await tx.studentApplication.update({ where: { id: application.id }, data: { status: "DECLINED", reviewedAt: new Date() } });
      const tracker = await tx.applicationTracking.findFirst({ where: { studentApplicationId: application.id }, orderBy: { createdAt: "desc" } });
      if (tracker) await tx.applicationTracking.update({ where: { id: tracker.id }, data: { status: "CLOSED", outcome: "DECLINED", closedAt: new Date(), statusHistory: [...(Array.isArray(tracker.statusHistory) ? tracker.statusHistory : []), trackingEvent("DECLINED", note), trackingEvent("CLOSED", "Owner-reviewed admissions decision completed")] } });
      await tx.notification.create({ data: { userId: application.userId, type: "ACADEMIC", title: "Admissions decision completed", body: note, actionUrl: "/admissions/status", dedupeKey: `admission-declined:${application.id}` } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "ADMISSION_OWNER_DECLINED", entity: "StudentApplication", entityId: application.id, detail: { note } } });
    });
    return NextResponse.json({ status: "DECLINED" });
  }

  return NextResponse.json({ error: "Unknown admissions action." }, { status: 400 });
}
