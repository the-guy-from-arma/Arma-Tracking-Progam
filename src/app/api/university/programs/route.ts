import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";
import { trackingEvent } from "@/lib/application-tracking";
import { buildProgramAudits, getCompletedCourseIds, getProgramAudit } from "@/lib/academic-progress";
import { policyGateResponse } from "@/lib/policies";
import { campusRestrictionResponse, studentAcademicRestrictionResponse } from "@/lib/campus-operations";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (user.isStudent) { const gate = await policyGateResponse(user.id); if (gate) return gate; }
  const [programs, applications, completedCourseIds, completedProgramEnrollments] = await Promise.all([
    db.academicProgram.findMany({
      where: { active: true },
      include: { requirements: { include: { course: { select: { id: true, code: true, title: true, summary: true, academy: true, learningCredits: true, serviceValueCents: true, estimatedDays: true, workloadHours: true } } }, orderBy: { sequence: "asc" } }, enrollments: { where: { userId: user.id } }, applications: { where: { userId: user.id } } },
      orderBy: [{ academy: "asc" }, { level: "asc" }, { code: "asc" }],
    }),
    isAdmin(user.role) ? db.programApplication.findMany({ where: { status: "SUBMITTED" }, include: { user: { select: { name: true, academicEmail: true, studentNumber: true } }, program: { select: { title: true, code: true } } }, orderBy: { submittedAt: "asc" } }) : Promise.resolve([]),
    getCompletedCourseIds(user.id),
    db.programEnrollment.findMany({ where: { userId: user.id, status: "COMPLETED" }, select: { programId: true } }),
  ]);
  const audits = buildProgramAudits(programs, completedCourseIds, new Set(completedProgramEnrollments.map((item) => item.programId)));
  return NextResponse.json({ programs: programs.map((program) => ({ ...program, audit: audits.get(program.id) })), pendingApplications: applications, degreeWordingEnabled: process.env.DEGREE_WORDING_ENABLED === "true" });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (user.isStudent) { const gate = await policyGateResponse(user.id); if (gate) return gate; }
  { const gate = await campusRestrictionResponse("ENROLLMENT") || await studentAcademicRestrictionResponse(user.id, "ENROLLMENT"); if (gate) return gate; }
  const body = await request.json().catch(() => ({}));
  const programId = text(body.programId, 100);
  if (body.fundingAcknowledged !== true || body.refundPolicyAcknowledged !== true) return NextResponse.json({ error: "Review and acknowledge the sponsored-learning allocation and withdrawal policy before activating a program." }, { status: 400 });
  const program = await db.academicProgram.findFirst({ where: { id: programId, active: true } });
  if (!program) return NextResponse.json({ error: "Program not found" }, { status: 404 });
  const audit = await getProgramAudit(user.id, programId);
  if (!audit?.eligible) return NextResponse.json({ error: audit?.blocker || "Complete the required prior academic pathway before enrollment.", audit }, { status: 409 });
  const enrollment = await db.$transaction(async (tx) => {
    const legacyApplication = await tx.programApplication.findUnique({ where: { programId_userId: { programId, userId: user.id } } });
    if (legacyApplication && ["SUBMITTED", "WAITLISTED"].includes(legacyApplication.status)) {
      await tx.programApplication.update({ where: { id: legacyApplication.id }, data: { status: "ADMITTED", decisionNote: "Superseded by direct student enrollment confirmation.", decidedAt: new Date() } });
      const trackers = await tx.applicationTracking.findMany({ where: { programApplicationId: legacyApplication.id, status: { in: ["OPEN", "IN_REVIEW"] } } });
      for (const tracker of trackers) await tx.applicationTracking.update({ where: { id: tracker.id }, data: { status: "CLOSED", outcome: "DIRECT_ENROLLMENT", closedAt: new Date(), statusHistory: [...(Array.isArray(tracker.statusHistory) ? tracker.statusHistory : []), trackingEvent("ADMITTED", "Program activated by direct student confirmation"), trackingEvent("CLOSED", "Program applications are no longer required")] } });
    }
    const record = await tx.programEnrollment.upsert({ where: { programId_userId: { programId, userId: user.id } }, update: { status: "ACTIVE", creditsEarned: audit.creditsApplied, programApplicationId: legacyApplication?.id }, create: { programId, userId: user.id, creditsEarned: audit.creditsApplied, programApplicationId: legacyApplication?.id } });
    await tx.studentActivityEvent.create({ data: { studentId: user.id, actorId: user.id, type: "ENROLLMENT", title: "Academic pathway activated", detail: program.title, entity: "ProgramEnrollment", entityId: record.id, metadata: { programCode: program.code, creditsApplied: audit.creditsApplied } } });
    await tx.notification.upsert({ where: { dedupeKey: `program-enrolled:${user.id}:${program.id}` }, update: { readAt: null, title: `${program.title} is now active`, body: "Your completed credits have been applied. Sponsored value will be allocated course by course only when you confirm each course." }, create: { userId: user.id, type: "ACADEMIC", title: `${program.title} is now active`, body: "Your completed credits have been applied. Sponsored value will be allocated course by course only when you confirm each course.", actionUrl: "/university?view=programs", dedupeKey: `program-enrolled:${user.id}:${program.id}` } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "PROGRAM_ENROLLED", entity: "AcademicProgram", entityId: programId, detail: { creditsApplied: audit.creditsApplied, allocationMethod: "COURSE_BY_COURSE", studentDueCents: 0, fundingDisclosureVersion: "SPONSORED_LEARNING_CONFIRMATION_V1", fundingAcknowledged: true, refundPolicyAcknowledged: true } } });
    return record;
  });
  return NextResponse.json({ enrollment }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: "Owner or administrator authority required" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const applicationId = text(body.applicationId, 100);
  const status = String(body.status || "");
  if (!["ADMITTED", "WAITLISTED", "DECLINED"].includes(status)) return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  const currentApplication = await db.programApplication.findUnique({ where: { id: applicationId } });
  if (!currentApplication) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  const audit = status === "ADMITTED" ? await getProgramAudit(currentApplication.userId, currentApplication.programId) : null;
  if (status === "ADMITTED" && !audit?.eligible) return NextResponse.json({ error: audit?.blocker || "The prerequisite academic pathway is incomplete.", audit }, { status: 409 });
  if (status === "ADMITTED") { const gate = await campusRestrictionResponse("ENROLLMENT"); if (gate) return gate; }
  const application = await db.programApplication.update({ where: { id: applicationId }, data: { status: status as never, decisionNote: text(body.decisionNote, 1000) || null, decidedAt: new Date() } });
  if (status === "ADMITTED") await db.programEnrollment.upsert({ where: { programId_userId: { programId: application.programId, userId: application.userId } }, update: { status: "ACTIVE", programApplicationId: application.id, creditsEarned: audit?.creditsApplied || 0 }, create: { programId: application.programId, userId: application.userId, programApplicationId: application.id, creditsEarned: audit?.creditsApplied || 0 } });
  const tracker = await db.applicationTracking.findFirst({ where: { programApplicationId: application.id, status: { in: ["OPEN", "IN_REVIEW"] } }, orderBy: { createdAt: "desc" } });
  if (tracker) await db.applicationTracking.update({ where: { id: tracker.id }, data: { status: "CLOSED", outcome: status, closedAt: application.decidedAt, statusHistory: [...(Array.isArray(tracker.statusHistory) ? tracker.statusHistory : []), trackingEvent(status, application.decisionNote || "Academic decision completed"), trackingEvent("CLOSED", "Application tracking closed")] } });
  await db.notification.create({ data: { userId: application.userId, type: "ACADEMIC", title: `Program application ${status.toLowerCase()}`, body: status === "ADMITTED" ? "Your pathway is active and ready for term planning." : application.decisionNote || "Your program application record has been updated.", actionUrl: "/university?view=programs", dedupeKey: `program-decision:${application.id}:${status}` } });
  return NextResponse.json({ application });
}
