import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { campusStatus, refreshOperationalStatus } from "@/lib/campus-operations";
import { db } from "@/lib/db";
import { text } from "@/lib/input";

const admissionsModes = new Set(["OPEN", "PAUSED"]);
const enrollmentModes = new Set(["OPEN", "PAUSED"]);
const learningModes = new Set(["ACTIVE", "ACADEMIC_BREAK", "MAINTENANCE", "EMERGENCY_CLOSURE"]);
const seasons = new Set(["GENERAL", "SPRING_RECESS", "SUMMER_SESSION", "WINTER_RECESS", "SEMESTER_TRANSITION", "MAINTENANCE", "EMERGENCY"]);

async function owner() {
  const user = await currentUser();
  return user?.role === "OWNER" ? user : null;
}

export async function GET() {
  const user = await owner();
  if (!user) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const [status, periods, activeEnrollments, pendingApplications] = await Promise.all([
    campusStatus(),
    db.institutionOperationalPeriod.findMany({ orderBy: { startsAt: "desc" }, take: 40 }),
    db.courseEnrollment.count({ where: { status: "ACTIVE" } }),
    db.studentApplication.count({ where: { status: { in: ["SUBMITTED", "UNDER_AUTOMATED_REVIEW", "CLARIFICATION_REQUIRED", "AUTOMATION_EXCEPTION"] } } }),
  ]);
  return NextResponse.json({ status, periods, impact: { activeEnrollments, pendingApplications } });
}

export async function POST(request: Request) {
  const user = await owner();
  if (!user) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const action = text(body.action, 30);

  if (action === "schedule" || action === "start_now") {
    const title = text(body.title, 120);
    const publicMessage = text(body.publicMessage, 600);
    const ownerNote = text(body.ownerNote, 1000) || null;
    const admissionsMode = String(body.admissionsMode || "OPEN");
    const enrollmentMode = String(body.enrollmentMode || "PAUSED");
    const learningMode = String(body.learningMode || "ACADEMIC_BREAK");
    const season = String(body.season || "GENERAL");
    const startsAt = action === "start_now" ? new Date() : new Date(String(body.startsAt || ""));
    const endsAt = new Date(String(body.endsAt || ""));
    if (title.length < 3 || publicMessage.length < 12 || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      return NextResponse.json({ error: "Add a public title, explanation, and a valid start and reopening time." }, { status: 400 });
    }
    if (!admissionsModes.has(admissionsMode) || !enrollmentModes.has(enrollmentMode) || !learningModes.has(learningMode) || !seasons.has(season)) {
      return NextResponse.json({ error: "Choose valid operating modes and a campus presentation." }, { status: 400 });
    }
    const period = await db.institutionOperationalPeriod.create({
      data: {
        title,
        publicMessage,
        ownerNote,
        admissionsMode: admissionsMode as never,
        enrollmentMode: enrollmentMode as never,
        learningMode: learningMode as never,
        season: season as never,
        startsAt,
        endsAt,
        createdById: user.id,
      },
    });
    await db.auditLog.create({ data: { actorId: user.id, action: action === "start_now" ? "CAMPUS_PERIOD_STARTED" : "CAMPUS_PERIOD_SCHEDULED", entity: "InstitutionOperationalPeriod", entityId: period.id, detail: { admissionsMode, enrollmentMode, learningMode, season, startsAt, endsAt, ownerNote } } });
    const students = await db.user.findMany({ where: { isStudent: true, accountClosedAt: null }, select: { id: true } });
    if (students.length) await db.notification.createMany({ data: students.map((student) => ({ userId: student.id, type: "SYSTEM" as const, title: action === "start_now" ? title : `Scheduled: ${title}`, body: `${publicMessage} Reopening is scheduled for ${endsAt.toLocaleString()}.`, actionUrl: "/university?view=notifications", dedupeKey: `campus-period-scheduled:${period.id}:${student.id}` })), skipDuplicates: true });
    await refreshOperationalStatus();
    return NextResponse.json({ period, status: await campusStatus() }, { status: 201 });
  }

  if (action === "reopen") {
    const setting = await refreshOperationalStatus();
    if (setting.activePeriodId) {
      await db.institutionOperationalPeriod.update({ where: { id: setting.activePeriodId }, data: { endsAt: new Date() } });
      await db.auditLog.create({ data: { actorId: user.id, action: "CAMPUS_REOPENED_EARLY", entity: "InstitutionOperationalPeriod", entityId: setting.activePeriodId, detail: { reason: text(body.reason, 500) } } });
    }
    return NextResponse.json({ status: await campusStatus() });
  }

  if (action === "cancel") {
    const periodId = text(body.periodId, 100);
    const period = await db.institutionOperationalPeriod.findUnique({ where: { id: periodId } });
    if (!period || period.status !== "SCHEDULED") return NextResponse.json({ error: "Only a scheduled future period can be cancelled." }, { status: 409 });
    await db.institutionOperationalPeriod.update({ where: { id: periodId }, data: { status: "CANCELLED" } });
    await db.auditLog.create({ data: { actorId: user.id, action: "CAMPUS_PERIOD_CANCELLED", entity: "InstitutionOperationalPeriod", entityId: periodId, detail: { reason: text(body.reason, 500) } } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown campus operations action." }, { status: 400 });
}
