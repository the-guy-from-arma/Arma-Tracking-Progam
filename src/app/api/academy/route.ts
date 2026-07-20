import { NextResponse } from "next/server";
import { canTeach, currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";
import { ensureCourseFunding } from "@/lib/funding";
import { queueSubmissionForAi } from "@/lib/ai-grading";
import { getCompletedCourseIds, getProgramSequenceBlockers } from "@/lib/academic-progress";
import { ensureStudentFacultyNetwork } from "@/lib/faculty-network";
import { policyGateResponse } from "@/lib/policies";
import { campusRestrictionResponse, campusStatus, selectionRestrictionResponse, studentAcademicRestrictionResponse } from "@/lib/campus-operations";
import { activateAcademicProgram } from "@/lib/program-enrollment";

const courseLevels = new Set(["FOUNDATION", "INTERMEDIATE", "ADVANCED", "CAPSTONE"]);
const studios = new Set(["Thunder Buddies Studios", "Black Ridge Studios", "Thunder Buddies Studios + Black Ridge Studios"]);

function positiveCredits(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 12 ? parsed : 3;
}

function serviceValueCents(value: unknown) {
  const dollars = Number(value);
  return Number.isFinite(dollars) && dollars >= 500 && dollars <= 50000 ? Math.round(dollars * 100) : 450000;
}

function approvedEvidenceUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (["community.bohemia.net", "reforger.armaplatform.com", "steamcommunity.com", "youtube.com", "youtu.be", "vimeo.com"].includes(host)) return true;
    return host === "github.com" && url.pathname.includes("/issues/");
  } catch { return false; }
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (user.isStudent) { const gate = await policyGateResponse(user.id); if (gate) return gate; }
  const admin = canTeach(user.role);
  const [courses, submissions, certificates, programs, grantLedger] = await Promise.all([
    db.course.findMany({
      where: admin ? {} : { OR: [{ status: "PUBLISHED", catalogVisible: true }, { catalogVisible: false, enrollments: { some: { userId: user.id } } }] },
      include: { enrollments: { where: { userId: user.id } }, _count: { select: { enrollments: true, submissions: true } } },
      orderBy: [{ level: "asc" }, { code: "asc" }],
    }),
    db.courseSubmission.findMany({
      where: admin ? {} : { studentId: user.id },
      include: {
        course: { select: { code: true, title: true, studio: true, learningCredits: true } },
        student: { select: { id: true, name: true, email: true } },
        reviewer: { select: { name: true } },
        certificate: true,
        aiDecisions: { orderBy: { createdAt: "desc" }, take: 1 },
        appeals: { orderBy: { submittedAt: "desc" }, take: 1 },
      },
      orderBy: { submittedAt: "desc" },
    }),
    db.certificate.findMany({ where: { userId: user.id }, include: { course: { select: { code: true, title: true, studio: true } } }, orderBy: { issuedAt: "desc" } }),
    db.academicProgram.findMany({ where: { active: true }, include: { enrollments: { where: { userId: user.id } } }, orderBy: { creditsRequired: "asc" } }),
    db.grantLedger.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  const learningCredits = certificates.reduce((total, certificate) => total + certificate.learningCredits, 0);
  return NextResponse.json({ courses, submissions, certificates, programs, grantLedger, grantBalanceCents: user.grantBalanceCents, learningCredits, canReview: admin, viewerId: user.id, operations: await campusStatus() });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (user.isStudent) { const gate = await policyGateResponse(user.id); if (gate) return gate; }
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");

  if (["enroll_course", "enroll_program"].includes(action)) { const gate = await campusRestrictionResponse("ENROLLMENT") || await studentAcademicRestrictionResponse(user.id, "ENROLLMENT"); if (gate) return gate; }
  if (action === "enroll_course") { const gate = await selectionRestrictionResponse("COURSE"); if (gate) return gate; }
  if (action === "enroll_program") { const gate = await selectionRestrictionResponse("PROGRAM"); if (gate) return gate; }
  if (action === "submit_mod") { const gate = await campusRestrictionResponse("SUBMISSION") || await studentAcademicRestrictionResponse(user.id, "SUBMISSION"); if (gate) return gate; }

  if (action === "create_course") {
    if (!canTeach(user.role)) return NextResponse.json({ error: "Faculty authoring authority required" }, { status: 403 });
    const code = text(body.code, 20).toUpperCase();
    const title = text(body.title, 100);
    const summary = text(body.summary, 800);
    const deliverable = text(body.deliverable, 800);
    const studio = text(body.studio, 100);
    const level = String(body.level || "");
    if (code.length < 3 || title.length < 3 || summary.length < 20 || deliverable.length < 20 || !studios.has(studio) || !courseLevels.has(level)) {
      return NextResponse.json({ error: "Complete the studio, course code, level, summary, and assessed deliverable." }, { status: 400 });
    }
    const course = await db.course.create({ data: { code, title, summary, deliverable, studio, level: level as never, status: "PUBLISHED", learningCredits: positiveCredits(body.learningCredits), serviceValueCents: serviceValueCents(body.serviceValue), createdById: user.id } }).catch(() => null);
    if (!course) return NextResponse.json({ error: "That course code is already in use." }, { status: 409 });
    await db.auditLog.create({ data: { actorId: user.id, action: "COURSE_PUBLISHED", entity: "Course", entityId: course.id, detail: { code, studio } } });
    return NextResponse.json({ course }, { status: 201 });
  }

  if (action === "enroll_course") {
    if (!user.isStudent && !isAdmin(user.role)) return NextResponse.json({ error: "Activate an Enscript University student identity before enrolling." }, { status: 403 });
    if (body.fundingAcknowledged !== true || body.refundPolicyAcknowledged !== true) return NextResponse.json({ error: "Review and acknowledge the sponsored-learning allocation and withdrawal policy before enrolling." }, { status: 400 });
    const courseId = text(body.courseId, 100);
    const course = await db.course.findFirst({ where: { id: courseId, status: "PUBLISHED" }, include: { prerequisites: true } });
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    const existing = await db.courseEnrollment.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
    if (existing?.status === "WITHDRAWN") return NextResponse.json({ error: "This course was withdrawn for the current term. Visit Student Center for advising before a future-term re-entry." }, { status: 409 });
    const completedCourseIds = await getCompletedCourseIds(user.id);
    if (completedCourseIds.has(courseId)) return NextResponse.json({ error: "This course is already complete. Its credits are automatically applied to every program that requires it.", fulfilled: true, courseId }, { status: 409 });
    if (existing) return NextResponse.json({ enrollment: existing, grantBalanceCents: user.grantBalanceCents, allocatedCents: 0 });
    if (course.prerequisites.length) {
      const missing = course.prerequisites.filter((item) => !completedCourseIds.has(item.prerequisiteId));
      if (missing.length) return NextResponse.json({ error: "Complete the listed prerequisite course before enrolling.", missingPrerequisiteIds: missing.map((item) => item.prerequisiteId) }, { status: 409 });
    }
    const sequenceBlockers = await getProgramSequenceBlockers(user.id, courseId, completedCourseIds);
    if (sequenceBlockers.length) return NextResponse.json({ error: `Complete the earlier program coursework first: ${sequenceBlockers.join(", ")}.`, sequenceBlockers }, { status: 409 });
    try { await ensureCourseFunding(user.id, course.id, course.serviceValueCents); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Course funding could not be confirmed." }, { status: 409 }); }
    const result = await db.$transaction(async (tx) => {
      const current = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { grantBalanceCents: true } });
      const grantBalanceCents = current.grantBalanceCents - course.serviceValueCents;
      const enrollment = await tx.courseEnrollment.create({ data: { courseId, userId: user.id, expectedEndAt: new Date(Date.now() + course.estimatedDays * 86_400_000) } });
      await tx.user.update({ where: { id: user.id }, data: { grantBalanceCents } });
      const sources = await tx.fundingAward.findMany({ where: { userId: user.id, status: { in: ["AVAILABLE", "PARTIALLY_USED", "ADJUSTED"] }, remainingAmountCents: { gt: 0 } }, orderBy: [{ expiresAt: "asc" }, { awardedAt: "asc" }] });
      let required = course.serviceValueCents; let primarySourceId: string | null = null;
      for (const source of sources) { if (!required) break; const used = Math.min(required, source.remainingAmountCents); if (!primarySourceId) primarySourceId = source.id; const remaining = source.remainingAmountCents - used; await tx.fundingAward.update({ where: { id: source.id }, data: { remainingAmountCents: remaining, status: remaining === 0 ? "FULLY_USED" : "PARTIALLY_USED" } }); required -= used; }
      if (required) throw new Error("Funding source reconciliation failed. Enrollment was not changed.");
      await tx.grantLedger.create({ data: { userId: user.id, fundingAwardId: primarySourceId, type: "COURSE_ALLOCATION", amountCents: -course.serviceValueCents, description: `${course.code} ${course.title} sponsored service allocation`, courseId, idempotencyKey: `allocation:${user.id}:${course.id}`, runningBalanceCents: grantBalanceCents, publicReason: "COURSE_ENROLLMENT", metadata: { studentResponsibilityCents: 0, nonCash: true, allocationMethod: "FIFO_EXPIRATION" } } });
      await tx.studentActivityEvent.create({ data: { studentId: user.id, actorId: user.id, type: "ENROLLMENT", title: `Enrolled in ${course.code}`, detail: course.title, entity: "CourseEnrollment", entityId: enrollment.id } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "COURSE_ENROLLED", entity: "Course", entityId: courseId, detail: { serviceValueCents: course.serviceValueCents, studentDueCents: 0, grantBalanceCents, fundingDisclosureVersion: "SPONSORED_LEARNING_CONFIRMATION_V1", fundingAcknowledged: true, refundPolicyAcknowledged: true } } });
      return { enrollment, grantBalanceCents };
    });
    await ensureStudentFacultyNetwork(user.id);
    return NextResponse.json({ ...result, allocatedCents: course.serviceValueCents, studentDueCents: 0 });
  }

  if (action === "submit_mod") {
    const courseId = text(body.courseId, 100);
    const title = text(body.title, 120);
    const summary = text(body.summary, 1400);
    const referenceUrl = text(body.referenceUrl, 300);
    const demoUrl = text(body.demoUrl, 300);
    if (title.length < 3 || summary.length < 30 || !approvedEvidenceUrl(referenceUrl) || !approvedEvidenceUrl(demoUrl)) return NextResponse.json({ error: "Add a detailed brief and use approved Bohemia, Workshop, Steam, YouTube, Vimeo, or GitHub issue evidence links." }, { status: 400 });
    const enrollment = await db.courseEnrollment.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
    if (!enrollment || enrollment.status !== "ACTIVE") return NextResponse.json({ error: "Activate the course before submitting its culminating work." }, { status: 409 });
    if (enrollment.progress < 100) return NextResponse.json({ error: "Complete every course day before submitting the culminating work.", progress: enrollment.progress }, { status: 409 });
    const completedCourseIds = await getCompletedCourseIds(user.id);
    const sequenceBlockers = await getProgramSequenceBlockers(user.id, courseId, completedCourseIds);
    if (sequenceBlockers.length) return NextResponse.json({ error: `Complete the earlier program coursework first: ${sequenceBlockers.join(", ")}.`, sequenceBlockers }, { status: 409 });
    const existing = await db.courseSubmission.findUnique({ where: { courseId_studentId: { courseId, studentId: user.id } } });
    if (existing && ["SUBMITTED", "PENDING_AI_REVIEW", "AI_REVIEWING", "AI_EXCEPTION", "IN_REVIEW", "APPROVED", "APPEALED"].includes(existing.status)) return NextResponse.json({ error: "This course already has an active, exception, appealed, or approved submission." }, { status: 409 });
    const aiEnabled = process.env.AI_GRADING_ENABLED === "true";
    const submission = await db.courseSubmission.upsert({
      where: { courseId_studentId: { courseId, studentId: user.id } },
      update: { title, summary, referenceUrl: referenceUrl || null, demoUrl: demoUrl || null, status: aiEnabled ? "PENDING_AI_REVIEW" : "SUBMITTED", feedback: null, reviewerId: null, reviewedAt: null, submittedAt: new Date(), resubmissionCount: { increment: 1 } },
      create: { courseId, studentId: user.id, title, summary, referenceUrl: referenceUrl || null, demoUrl: demoUrl || null, status: aiEnabled ? "PENDING_AI_REVIEW" : "SUBMITTED" },
    });
    if (aiEnabled) await queueSubmissionForAi(submission.id, submission.resubmissionCount);
    await db.courseEnrollment.update({ where: { id: enrollment.id }, data: { progress: 100 } });
    await db.auditLog.create({ data: { actorId: user.id, action: "MOD_SUBMITTED", entity: "CourseSubmission", entityId: submission.id, detail: { courseId, title } } });
    return NextResponse.json({ submission, grading: aiEnabled ? "QUEUED" : "FACULTY" }, { status: aiEnabled ? 202 : 201 });
  }

  if (action === "enroll_program") {
    if (body.fundingAcknowledged !== true || body.refundPolicyAcknowledged !== true) return NextResponse.json({ error: "Review and acknowledge the sponsored-learning allocation and withdrawal policy before activating a program." }, { status: 400 });
    const programId = text(body.programId, 100);
    try {
      const result = await activateAcademicProgram({
        userId: user.id,
        actorId: user.id,
        programId,
      });
      return NextResponse.json(result, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Program enrollment could not be completed.";
      if (message === "PROGRAM_NOT_FOUND") return NextResponse.json({ error: "Academic path not found" }, { status: 404 });
      return NextResponse.json({ error: message }, { status: 409 });
    }
  }

  return NextResponse.json({ error: "Unknown academy action" }, { status: 400 });
}
