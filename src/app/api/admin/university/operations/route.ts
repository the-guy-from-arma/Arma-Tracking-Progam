import { after, NextResponse } from "next/server";
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

async function notifyPeriodChange(periodId: string, title: string, body: string) {
  const students = await db.user.findMany({
    where: { isStudent: true, accountClosedAt: null },
    select: { id: true },
  });
  if (!students.length) return;
  await db.notification.createMany({
    data: students.map((student) => ({
      userId: student.id,
      type: "SYSTEM" as const,
      title,
      body,
      actionUrl: "/campus-status",
      dedupeKey: `campus-period-owner-change:${periodId}:${student.id}`,
    })),
    skipDuplicates: true,
  });
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
    const activatesNow = action === "start_now" || startsAt <= new Date();
    const period = await db.$transaction(async (tx) => {
      const created = await tx.institutionOperationalPeriod.create({
        data: {
          title,
          publicMessage,
          ownerNote,
          admissionsMode: admissionsMode as never,
          enrollmentMode: enrollmentMode as never,
          learningMode: learningMode as never,
          season: season as never,
          status: activatesNow ? "ACTIVE" : "SCHEDULED",
          activatedAt: activatesNow ? new Date() : null,
          startsAt,
          endsAt,
          createdById: user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: activatesNow ? "CAMPUS_PERIOD_STARTED" : "CAMPUS_PERIOD_SCHEDULED",
          entity: "InstitutionOperationalPeriod",
          entityId: created.id,
          detail: { admissionsMode, enrollmentMode, learningMode, season, startsAt, endsAt, ownerNote, activatesNow },
        },
      });
      return created;
    });
    await refreshOperationalStatus();
    const status = await campusStatus();
    after(async () => {
      try {
        const students = await db.user.findMany({ where: { isStudent: true, accountClosedAt: null }, select: { id: true } });
        if (students.length) {
          await db.notification.createMany({
            data: students.map((student) => ({
              userId: student.id,
              type: "SYSTEM" as const,
              title: activatesNow ? title : `Scheduled: ${title}`,
              body: `${publicMessage} Reopening is scheduled for ${endsAt.toLocaleString()}.`,
              actionUrl: "/university?view=notifications",
              dedupeKey: `campus-period-scheduled:${period.id}:${student.id}`,
            })),
            skipDuplicates: true,
          });
        }
      } catch {
        // The operating change is authoritative even when a notification must
        // be retried later.
      }
    });
    return NextResponse.json({ period, status, activatesNow }, { status: 201 });
  }

  if (action === "reopen") {
    const now = new Date();
    const reason = text(body.reason, 500) || "Owner reopened campus services.";
    const effectivePeriods = await db.institutionOperationalPeriod.findMany({
      where: {
        status: { in: ["SCHEDULED", "ACTIVE"] },
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      select: { id: true, status: true },
    });
    const activeIds = effectivePeriods.filter((period) => period.status === "ACTIVE").map((period) => period.id);
    const pendingIds = effectivePeriods.filter((period) => period.status === "SCHEDULED").map((period) => period.id);
    await db.$transaction(async (tx) => {
      if (activeIds.length) {
        await tx.institutionOperationalPeriod.updateMany({
          where: { id: { in: activeIds }, status: "ACTIVE" },
          data: { endsAt: now },
        });
      }
      if (pendingIds.length) {
        await tx.institutionOperationalPeriod.updateMany({
          where: { id: { in: pendingIds }, status: "SCHEDULED" },
          data: { status: "CANCELLED" },
        });
      }
      for (const period of effectivePeriods) {
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: period.status === "ACTIVE" ? "CAMPUS_REOPENED_EARLY" : "CAMPUS_PERIOD_CANCELLED",
            entity: "InstitutionOperationalPeriod",
            entityId: period.id,
            detail: { reason, reopenAll: true, previousStatus: period.status },
          },
        });
      }
    });
    await refreshOperationalStatus();
    return NextResponse.json({
      status: await campusStatus(),
      ended: activeIds.length,
      cancelled: pendingIds.length,
    });
  }

  if (action === "cancel" || action === "remove") {
    const periodId = text(body.periodId, 100);
    const reason = text(body.reason, 500) || "Removed from Owner Academic Operations.";
    await refreshOperationalStatus();
    const period = await db.institutionOperationalPeriod.findUnique({ where: { id: periodId } });
    if (!period) return NextResponse.json({ error: "Operating period not found." }, { status: 404 });
    if (period.status === "COMPLETED" || period.status === "CANCELLED") {
      return NextResponse.json({ ok: true, idempotentReplay: true, status: await campusStatus() });
    }

    const now = new Date();
    if (period.status === "ACTIVE") {
      await db.$transaction([
        db.institutionOperationalPeriod.update({ where: { id: periodId }, data: { endsAt: now } }),
        db.auditLog.create({ data: { actorId: user.id, action: "CAMPUS_PERIOD_ENDED_BY_OWNER", entity: "InstitutionOperationalPeriod", entityId: periodId, detail: { reason, previousEndsAt: period.endsAt } } }),
      ]);
      await refreshOperationalStatus();
      await notifyPeriodChange(periodId, `${period.title} ended`, "The owner ended this operating period. Current campus availability is shown on the campus status page.");
      return NextResponse.json({ ok: true, outcome: "ENDED", status: await campusStatus() });
    }

    await db.$transaction([
      db.institutionOperationalPeriod.update({ where: { id: periodId }, data: { status: "CANCELLED" } }),
      db.auditLog.create({ data: { actorId: user.id, action: "CAMPUS_PERIOD_CANCELLED", entity: "InstitutionOperationalPeriod", entityId: periodId, detail: { reason, previousStatus: period.status } } }),
    ]);
    await refreshOperationalStatus();
    await notifyPeriodChange(periodId, `${period.title} cancelled`, "This scheduled operating period has been removed. Current campus availability is shown on the campus status page.");
    return NextResponse.json({ ok: true, outcome: "CANCELLED", status: await campusStatus() });
  }

  return NextResponse.json({ error: "Unknown campus operations action." }, { status: 400 });
}
