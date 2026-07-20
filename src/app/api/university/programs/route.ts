import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";
import { trackingEvent } from "@/lib/application-tracking";
import { buildProgramAudits, getCompletedCourseIds, getProgramAudit } from "@/lib/academic-progress";
import { policyGateResponse } from "@/lib/policies";
import { campusRestrictionResponse, studentAcademicRestrictionResponse } from "@/lib/campus-operations";
import { activateAcademicProgram } from "@/lib/program-enrollment";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (user.isStudent) { const gate = await policyGateResponse(user.id); if (gate) return gate; }
  const [programs, applications, completedCourseIds, completedProgramEnrollments, courseEnrollments] = await Promise.all([
    db.academicProgram.findMany({
      where: { active: true },
      include: { requirements: { include: { course: { select: { id: true, code: true, title: true, summary: true, academy: true, learningCredits: true, serviceValueCents: true, estimatedDays: true, workloadHours: true } } }, orderBy: { sequence: "asc" } }, enrollments: { where: { userId: user.id } }, applications: { where: { userId: user.id } } },
      orderBy: [{ academy: "asc" }, { level: "asc" }, { code: "asc" }],
    }),
    isAdmin(user.role) ? db.programApplication.findMany({ where: { status: "SUBMITTED" }, include: { user: { select: { name: true, academicEmail: true, studentNumber: true } }, program: { select: { title: true, code: true } } }, orderBy: { submittedAt: "asc" } }) : Promise.resolve([]),
    getCompletedCourseIds(user.id),
    db.programEnrollment.findMany({ where: { userId: user.id, status: "COMPLETED" }, select: { programId: true } }),
    db.courseEnrollment.findMany({ where: { userId: user.id }, select: { courseId: true, status: true } }),
  ]);
  const audits = buildProgramAudits(programs, completedCourseIds, new Set(completedProgramEnrollments.map((item) => item.programId)));
  const enrollmentByCourse = new Map(courseEnrollments.map((item) => [item.courseId, item.status]));
  return NextResponse.json({ programs: programs.map((program) => {
    const missing = program.requirements.filter((item) => !completedCourseIds.has(item.courseId) && !enrollmentByCourse.has(item.courseId));
    const withdrawn = program.requirements.filter((item) => enrollmentByCourse.get(item.courseId) === "WITHDRAWN");
    const registered = program.requirements.filter((item) => {
      const status = enrollmentByCourse.get(item.courseId);
      return completedCourseIds.has(item.courseId) || status === "ACTIVE" || status === "COMPLETED";
    });
    return {
      ...program,
      audit: audits.get(program.id),
      registrationSummary: {
        required: program.requirements.length,
        registered: registered.length,
        missing: missing.length,
        withdrawn: withdrawn.length,
        missingCourseCodes: missing.map((item) => item.course.code),
        withdrawnCourseCodes: withdrawn.map((item) => item.course.code),
        unregisteredValueCents: missing.reduce((total, item) => total + item.course.serviceValueCents, 0),
      },
    };
  }), pendingApplications: applications, degreeWordingEnabled: process.env.DEGREE_WORDING_ENABLED === "true" });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (user.isStudent) { const gate = await policyGateResponse(user.id); if (gate) return gate; }
  { const gate = await campusRestrictionResponse("ENROLLMENT") || await studentAcademicRestrictionResponse(user.id, "ENROLLMENT"); if (gate) return gate; }
  const body = await request.json().catch(() => ({}));
  const programId = text(body.programId, 100);
  if (body.fundingAcknowledged !== true || body.refundPolicyAcknowledged !== true) return NextResponse.json({ error: "Review and acknowledge the sponsored-learning allocation and withdrawal policy before activating a program." }, { status: 400 });
  try {
    const result = await activateAcademicProgram({
      userId: user.id,
      actorId: user.id,
      programId,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Program enrollment could not be completed.";
    if (message === "PROGRAM_NOT_FOUND") return NextResponse.json({ error: "Program not found" }, { status: 404 });
    return NextResponse.json({ error: message }, { status: 409 });
  }
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
  if (status === "ADMITTED") {
    try {
      await activateAcademicProgram({
        userId: application.userId,
        actorId: user.id,
        programId: application.programId,
      });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "The program curriculum could not be registered." }, { status: 409 });
    }
  }
  const tracker = await db.applicationTracking.findFirst({ where: { programApplicationId: application.id, status: { in: ["OPEN", "IN_REVIEW"] } }, orderBy: { createdAt: "desc" } });
  if (tracker) await db.applicationTracking.update({ where: { id: tracker.id }, data: { status: "CLOSED", outcome: status, closedAt: application.decidedAt, statusHistory: [...(Array.isArray(tracker.statusHistory) ? tracker.statusHistory : []), trackingEvent(status, application.decisionNote || "Academic decision completed"), trackingEvent("CLOSED", "Application tracking closed")] } });
  await db.notification.create({ data: { userId: application.userId, type: "ACADEMIC", title: `Program application ${status.toLowerCase()}`, body: status === "ADMITTED" ? "Your pathway is active and ready for term planning." : application.decisionNote || "Your program application record has been updated.", actionUrl: "/university?view=programs", dedupeKey: `program-decision:${application.id}:${status}` } });
  return NextResponse.json({ application });
}
