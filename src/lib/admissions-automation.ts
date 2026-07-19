import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ensureStudentFacultyNetwork } from "@/lib/faculty-network";
import { trackingEvent } from "@/lib/application-tracking";
import { policyCompliance } from "@/lib/policies";

export const INITIAL_GRANT_CENTS = 5_000_000;
export const ESTIMATED_PROGRAM_VALUE_CENTS = 4_275_000;
const DECISION_VERSION = "efu-character-duration-v1";
const MIN_REVIEW_DELAY_MS = 90_000;
const MAX_REVIEW_DELAY_MS = 10 * 60_000;
const REVIEW_DELAY_PER_CHARACTER_MS = 150;

function clean(value: unknown, max = 600) {
  return String(value || "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

type ReviewTimingInput = {
  workbenchExperience: string;
  enforceExperience: string;
  learningGoals: string;
  fundingStatement: string;
  clarificationResponses?: unknown[];
};

function responseCharacters(value: unknown) {
  if (Array.isArray(value))
    return value.reduce((total, item) => total + responseCharacters(item), 0);
  return String(value || "").trim().length;
}

export function admissionReviewTiming(input: ReviewTimingInput, from = new Date()) {
  const characterCount =
    responseCharacters(input.workbenchExperience) +
    responseCharacters(input.enforceExperience) +
    responseCharacters(input.learningGoals) +
    responseCharacters(input.fundingStatement) +
    responseCharacters(input.clarificationResponses || []);
  const delayMs = Math.min(
    MAX_REVIEW_DELAY_MS,
    Math.max(
      MIN_REVIEW_DELAY_MS,
      MIN_REVIEW_DELAY_MS + characterCount * REVIEW_DELAY_PER_CHARACTER_MS,
    ),
  );
  return {
    characterCount,
    delayMs,
    availableAt: new Date(from.getTime() + delayMs),
  };
}

function identityDomain() {
  return String(process.env.UNIVERSITY_IDENTITY_DOMAIN || "enfusionuniversity.edu").trim().toLowerCase().replace(/^@/, "");
}

function aliasFor(name: string, studentNumber: string) {
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, "").trim().split(/\s+/).filter(Boolean);
  const readable = base.length > 1 ? `${base[0]}.${base.at(-1)}` : base[0] || "student";
  return `${readable}${studentNumber.slice(-6)}`;
}

async function ensureOrientationCourse(tx: Prisma.TransactionClient) {
  const course = await tx.course.upsert({
    where: { code: "EFU-ORI-100" },
    update: { status: "DRAFT", catalogVisible: false, learningCredits: 0, serviceValueCents: 0 },
    create: {
      code: "EFU-ORI-100",
      title: "Campus Orientation & Academic Readiness",
      summary: "A guided introduction to campus navigation, academic records, sponsored-learning terminology, integrity expectations, advising, and thoughtful course selection.",
      deliverable: "Complete the orientation checklist and prepare a first-course planning note with your academic advisor.",
      studio: "Thunder Buddies Studios + Black Ridge Studios",
      academy: "University Orientation",
      level: "FOUNDATION",
      status: "DRAFT",
      catalogVisible: false,
      learningCredits: 0,
      serviceValueCents: 0,
      estimatedDays: 1,
      workloadHours: 1,
      outcomes: ["Navigate the student campus", "Understand academic and funding records", "Prepare for advisor-guided course selection"],
    },
  });
  await tx.courseDay.upsert({
    where: { courseId_dayNumber: { courseId: course.id, dayNumber: 1 } },
    update: {},
    create: {
      courseId: course.id,
      dayNumber: 1,
      title: "Your first day at Enfusion University",
      objectives: ["Locate essential campus services", "Review academic expectations", "Prepare a first-course conversation"],
      instructionalText: "Welcome to Enfusion University. This orientation introduces the records, support systems, policies, and planning tools that will follow you throughout your studies.",
      sourceSection: "Institutional orientation; no external technical source is required.",
      workbenchSteps: ["Open Student Center", "Review Policies & Agreements", "Open Funding Center", "Locate Messages", "Write your first-course planning note"],
      practicalLab: "Visit each core campus service and prepare a short note describing the first technical skill you want to build.",
      completionChecklist: ["Student Center reviewed", "Funding terminology reviewed", "Advisor located", "Planning note prepared"],
      knowledgeQuestion: "What should you do before enrolling in your first technical course?",
      knowledgeAnswer: "Review prerequisites and confirm the course with academic advising.",
      reflectionPrompt: "What do you want to build, and how much time can you consistently study each week?",
    },
  });
  return course;
}

export async function finalizeAdmission(applicationId: string, actorId?: string | null) {
  const result = await db.$transaction(async (tx) => {
    const application = await tx.studentApplication.findUniqueOrThrow({ where: { id: applicationId }, include: { user: true } });
    if (application.status === "ADMITTED" && application.user.isStudent) return { user: application.user, admitted: false };
    const studentNumber = `EFU-${new Date().getUTCFullYear()}-${crypto.randomInt(100000, 999999)}`;
    const academicEmail = `${aliasFor(application.user.name, studentNumber)}@${identityDomain()}`;
    const nextBalance = application.user.grantBalanceCents + INITIAL_GRANT_CENTS;
    const user = await tx.user.update({
      where: { id: application.userId },
      data: { isStudent: true, studentNumber, academicEmail, grantBalanceCents: nextBalance },
    });
    await tx.studentApplication.update({ where: { id: application.id }, data: { status: "ADMITTED", reviewedAt: new Date() } });
    const tracker = await tx.applicationTracking.findFirstOrThrow({ where: { studentApplicationId: application.id } });
    const history = Array.isArray(tracker.statusHistory) ? tracker.statusHistory : [];
    await tx.applicationTracking.update({
      where: { id: tracker.id },
      data: { status: "CLOSED", outcome: "ADMITTED", closedAt: new Date(), statusHistory: [...history, trackingEvent("ADMITTED", "Automated review completed; campus identity and orientation activated")] },
    });
    const fundingAward = await tx.fundingAward.upsert({
      where: { referenceNumber: `ADMISSION-${user.id}` },
      update: {},
      create: { referenceNumber: `ADMISSION-${user.id}`, userId: user.id, type: "INTERNAL_GRANT", sourceName: "Thunder Buddies Studios Sponsored Learning Grant", originalAmountCents: INITIAL_GRANT_CENTS, remainingAmountCents: INITIAL_GRANT_CENTS, publicDescription: "Opening sponsored-learning value issued upon admission.", restrictions: "Eligible Enfusion University learning services only; noncashable and nontransferable.", issuingDepartment: "Office of Admissions" },
    });
    await tx.grantLedger.upsert({
      where: { idempotencyKey: `admission-award:${user.id}` },
      update: {},
      create: { userId: user.id, fundingAwardId: fundingAward.id, type: "INITIAL_AWARD", amountCents: INITIAL_GRANT_CENTS, description: "Thunder Buddies Studios Sponsored Learning Grant", runningBalanceCents: nextBalance, referenceNumber: `EFT-ADMISSION-${user.id}`, idempotencyKey: `admission-award:${user.id}`, metadata: { nonCash: true, studentResponsibilityCents: 0 } },
    });
    const orientation = await ensureOrientationCourse(tx);
    const enrollment = await tx.courseEnrollment.upsert({
      where: { courseId_userId: { courseId: orientation.id, userId: user.id } },
      update: { status: "ACTIVE" },
      create: { courseId: orientation.id, userId: user.id, expectedEndAt: new Date(Date.now() + 86_400_000) },
    });
    await tx.notification.upsert({
      where: { dedupeKey: `admission-welcome:${user.id}` },
      update: {},
      create: { userId: user.id, type: "ACADEMIC", title: "Welcome to Enfusion University", body: "Your student identity is active. Begin Campus Orientation, then meet with Dr. Elara Voss before confirming your first technical course.", actionUrl: "/university?view=learning", dedupeKey: `admission-welcome:${user.id}` },
    });
    await tx.studentActivityEvent.create({ data: { studentId: user.id, actorId: actorId || user.id, type: "APPLICATION", title: "Admitted to Enfusion University", detail: "Automated review completed and the student record was activated.", entity: "StudentApplication", entityId: application.id } });
    await tx.studentActivityEvent.create({ data: { studentId: user.id, actorId: actorId || user.id, type: "ENROLLMENT", title: "Enrolled in EFU-ORI-100", detail: orientation.title, entity: "CourseEnrollment", entityId: enrollment.id } });
    await tx.auditLog.create({ data: { actorId: actorId || user.id, action: "UNIVERSITY_STUDENT_AUTO_ADMITTED", entity: "StudentApplication", entityId: application.id, detail: { studentNumber, academicEmail, orientationCourseId: orientation.id, grantAwardCents: INITIAL_GRANT_CENTS } } });
    return { user, admitted: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (result.admitted) await ensureStudentFacultyNetwork(result.user.id);
  return result;
}

export async function queueAdmissionReview(applicationId: string, clarificationRound = 0) {
  const application = await db.studentApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      clarifications: {
        where: { submittedAt: { not: null } },
        select: { response: true },
      },
    },
  });
  const timing = admissionReviewTiming({
    workbenchExperience: application.workbenchExperience,
    enforceExperience: application.enforceExperience,
    learningGoals: application.learningGoals,
    fundingStatement: application.fundingStatement,
    clarificationResponses: application.clarifications.map(
      (clarification) => clarification.response,
    ),
  });
  const idempotencyKey = `admission-review:${applicationId}:r${clarificationRound}`;
  return db.admissionReviewJob.upsert({
    where: { idempotencyKey },
    update: { status: "QUEUED", stage: "APPLICATION_RECEIVED", availableAt: timing.availableAt, lockedAt: null, heartbeatAt: null, lastError: null },
    create: { applicationId, clarificationRound, idempotencyKey, availableAt: timing.availableAt, maxAttempts: Number(process.env.ADMISSIONS_MAX_RETRIES || 3) },
  });
}

export async function processNextAdmissionReview() {
  if (process.env.ADMISSIONS_AUTOMATION_ENABLED !== "true") return { processed: false, reason: "disabled" };
  const staleBefore = new Date(Date.now() - 5 * 60_000);
  await db.admissionReviewJob.updateMany({
    where: { status: "PROCESSING", OR: [{ heartbeatAt: { lt: staleBefore } }, { heartbeatAt: null, lockedAt: { lt: staleBefore } }] },
    data: { status: "QUEUED", availableAt: new Date(), lockedAt: null, heartbeatAt: null, lastError: "A stale admissions worker lease was safely reclaimed." },
  });
  const job = await db.admissionReviewJob.findFirst({ where: { status: "QUEUED", availableAt: { lte: new Date() } }, orderBy: { createdAt: "asc" } });
  if (!job) return { processed: false, reason: "empty" };
  const claimedAt = new Date();
  const claimed = await db.admissionReviewJob.updateMany({ where: { id: job.id, status: "QUEUED" }, data: { status: "PROCESSING", stage: "IDENTITY_ELIGIBILITY", attempt: { increment: 1 }, lockedAt: claimedAt, heartbeatAt: claimedAt } });
  if (!claimed.count) return { processed: false, reason: "claimed" };
  const record = await db.admissionReviewJob.findUniqueOrThrow({
    where: { id: job.id },
    include: { application: { include: { clarifications: { where: { submittedAt: { not: null } }, orderBy: { round: "asc" } } } } },
  });
  const consent = await policyCompliance(record.application.userId);
  if (!consent.compliant) {
    await db.admissionReviewJob.update({ where: { id: record.id }, data: { status: "WAITING_FOR_CONSENT", stage: "POLICY_INTEGRITY", lockedAt: null, heartbeatAt: null, lastError: "Current policy acceptance required" } });
    await db.notification.upsert({ where: { dedupeKey: `admission-policy-consent:${record.applicationId}` }, update: {}, create: { userId: record.application.userId, type: "SYSTEM", title: "Review updated university policies", body: "A material policy changed while your application was under review. Your application is preserved and will resume after you sign the current bundle.", actionUrl: "/policies/accept", dedupeKey: `admission-policy-consent:${record.applicationId}` } });
    return { processed: false, reason: "waiting_for_consent" };
  }
  await db.admissionReviewJob.update({ where: { id: record.id }, data: { stage: "ACADEMIC_READINESS", heartbeatAt: new Date() } });
  try {
    const timing = admissionReviewTiming({
      workbenchExperience: record.application.workbenchExperience,
      enforceExperience: record.application.enforceExperience,
      learningGoals: record.application.learningGoals,
      fundingStatement: record.application.fundingStatement,
      clarificationResponses: record.application.clarifications.map(
        (clarification) => clarification.response,
      ),
    });
    await db.admissionReviewJob.update({ where: { id: record.id }, data: { stage: "POLICY_INTEGRITY", heartbeatAt: new Date() } });
    await db.admissionReviewJob.update({ where: { id: record.id }, data: { stage: "DECISION_PREPARATION", heartbeatAt: new Date() } });
    const structuredResult = {
      decision: "AUTO_ADMITTED",
      basis: "REQUIRED_FIELDS_AND_CHARACTER_DURATION",
      characterCount: timing.characterCount,
      delayMs: timing.delayMs,
    };
    await db.admissionReviewDecision.upsert({
      where: { jobId: record.id },
      update: {
        outcome: "AUTO_ADMITTED",
        score: 100,
        confidence: 1,
        modelId: "NO_MODEL_DETERMINISTIC",
        promptVersion: DECISION_VERSION,
        strengths: ["All required application sections passed submission validation."],
        concerns: [],
        integrityFlags: [],
        questions: [],
        structuredResult,
        validationResult: { valid: true, method: "CHARACTER_COUNT_DURATION" },
      },
      create: {
        jobId: record.id,
        outcome: "AUTO_ADMITTED",
        score: 100,
        confidence: 1,
        modelId: "NO_MODEL_DETERMINISTIC",
        promptVersion: DECISION_VERSION,
        strengths: ["All required application sections passed submission validation."],
        concerns: [],
        integrityFlags: [],
        questions: [],
        structuredResult,
        validationResult: { valid: true, method: "CHARACTER_COUNT_DURATION" },
      },
    });
    await finalizeAdmission(record.applicationId);
    await db.admissionReviewJob.update({
      where: { id: record.id },
      data: {
        status: "COMPLETED",
        stage: "AUTO_ADMITTED",
        lockedAt: null,
        heartbeatAt: null,
        lastError: null,
      },
    });
    return { processed: true, jobId: record.id, outcome: "AUTO_ADMITTED" };
  } catch (error) {
    const latest = await db.admissionReviewJob.findUniqueOrThrow({ where: { id: record.id } });
    const exhausted = latest.attempt >= latest.maxAttempts;
    const message = clean(error instanceof Error ? error.message : "Admissions review failed", 500);
    await db.$transaction([
      db.admissionReviewJob.update({ where: { id: record.id }, data: { status: exhausted ? "EXCEPTION" : "QUEUED", availableAt: new Date(Date.now() + Math.min(5, 2 ** latest.attempt) * 30_000), lockedAt: null, heartbeatAt: null, lastError: message } }),
      ...(exhausted ? [db.studentApplication.update({ where: { id: record.applicationId }, data: { status: "AUTOMATION_EXCEPTION" } })] : []),
    ]);
    return { processed: true, jobId: record.id, retrying: !exhausted };
  }
}

export function admissionAwardSummary(academicIdentity: string, studentNumber: string, applicationTrackingNumber: string) {
  return {
    academicIdentity,
    studentNumber,
    applicationTrackingNumber,
    estimatedProgramValueCents: ESTIMATED_PROGRAM_VALUE_CENTS,
    grantAwardCents: INITIAL_GRANT_CENTS,
    studentDueCents: 0,
    availableGrantBalanceCents: INITIAL_GRANT_CENTS,
    breakdown: [
      { label: "Digital instruction and academic services", amountCents: 1_800_000 },
      { label: "Studio mentorship and technical review", amountCents: 1_200_000 },
      { label: "Workbench e-services and learning infrastructure", amountCents: 675_000 },
      { label: "Portfolio assessment and credential services", amountCents: 600_000 },
    ],
    disclosure: "Estimated sponsored-service values are internal program estimates. The grant is non-cash, is not federal student aid, creates no debt, and may only be allocated to Enfusion University learning services.",
  };
}
