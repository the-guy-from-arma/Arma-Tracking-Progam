import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";
import { createTrackingNumber, trackingEvent } from "@/lib/application-tracking";
import { buildProgramAudits, getCompletedCourseIds, getProgramAudit } from "@/lib/academic-progress";
import { policyGateResponse } from "@/lib/policies";

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
  const body = await request.json().catch(() => ({}));
  const programId = text(body.programId, 100);
  const statement = text(body.statement, 2000);
  const experience = text(body.experience, 500);
  const weeklyHours = Number(body.weeklyHours);
  if (statement.length < 80 || experience.length < 10 || !Number.isInteger(weeklyHours) || weeklyHours < 2 || weeklyHours > 80) return NextResponse.json({ error: "Add a detailed program statement, experience summary, and weekly availability." }, { status: 400 });
  const program = await db.academicProgram.findFirst({ where: { id: programId, active: true } });
  if (!program) return NextResponse.json({ error: "Program not found" }, { status: 404 });
  const audit = await getProgramAudit(user.id, programId);
  if (!audit?.eligible) return NextResponse.json({ error: audit?.blocker || "Complete the required prior academic pathway before applying.", audit }, { status: 409 });
  const application = await db.programApplication.upsert({ where: { programId_userId: { programId, userId: user.id } }, update: { statement, experience, weeklyHours, status: "SUBMITTED", submittedAt: new Date(), decisionNote: null, decidedAt: null }, create: { programId, userId: user.id, statement, experience, weeklyHours } });
  await db.$transaction(async (tx) => {
    const open = await tx.applicationTracking.findMany({ where: { programApplicationId: application.id, status: { in: ["OPEN", "IN_REVIEW"] } } });
    for (const record of open) await tx.applicationTracking.update({ where: { id: record.id }, data: { status: "CLOSED", outcome: "SUPERSEDED", closedAt: new Date(), statusHistory: [...(Array.isArray(record.statusHistory) ? record.statusHistory : []), trackingEvent("CLOSED", "A newer application submission replaced this tracking record")] } });
    await tx.applicationTracking.create({ data: { trackingNumber: createTrackingNumber("PROGRAM"), userId: user.id, type: "PROGRAM", status: "OPEN", programApplicationId: application.id, submittedAt: application.submittedAt, statusHistory: [trackingEvent("SUBMITTED", `${program.code} application received`), trackingEvent("OPEN", "Awaiting academic decision")] } });
  });
  await db.auditLog.create({ data: { actorId: user.id, action: "PROGRAM_APPLICATION_SUBMITTED", entity: "ProgramApplication", entityId: application.id, detail: { programId } } });
  return NextResponse.json({ application }, { status: 201 });
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
  const application = await db.programApplication.update({ where: { id: applicationId }, data: { status: status as never, decisionNote: text(body.decisionNote, 1000) || null, decidedAt: new Date() } });
  if (status === "ADMITTED") await db.programEnrollment.upsert({ where: { programId_userId: { programId: application.programId, userId: application.userId } }, update: { status: "ACTIVE", programApplicationId: application.id, creditsEarned: audit?.creditsApplied || 0 }, create: { programId: application.programId, userId: application.userId, programApplicationId: application.id, creditsEarned: audit?.creditsApplied || 0 } });
  const tracker = await db.applicationTracking.findFirst({ where: { programApplicationId: application.id, status: { in: ["OPEN", "IN_REVIEW"] } }, orderBy: { createdAt: "desc" } });
  if (tracker) await db.applicationTracking.update({ where: { id: tracker.id }, data: { status: "CLOSED", outcome: status, closedAt: application.decidedAt, statusHistory: [...(Array.isArray(tracker.statusHistory) ? tracker.statusHistory : []), trackingEvent(status, application.decisionNote || "Academic decision completed"), trackingEvent("CLOSED", "Application tracking closed")] } });
  await db.notification.create({ data: { userId: application.userId, type: "ACADEMIC", title: `Program application ${status.toLowerCase()}`, body: status === "ADMITTED" ? "Your pathway is active and ready for term planning." : application.decisionNote || "Your program application record has been updated.", actionUrl: "/university?view=programs", dedupeKey: `program-decision:${application.id}:${status}` } });
  return NextResponse.json({ application });
}
