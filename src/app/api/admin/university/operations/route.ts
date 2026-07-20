import { after, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import {
  campusStatus,
  manualOperationEnd,
  MANUAL_OPERATION_NOTE,
  refreshOperationalStatus,
} from "@/lib/campus-operations";
import { db } from "@/lib/db";
import { text } from "@/lib/input";

const learningModes = new Set(["ACTIVE", "ACADEMIC_BREAK", "MAINTENANCE", "EMERGENCY_CLOSURE"]);
const navigationViews = new Set([
  "learning", "programs", "catalog", "student-center", "messages", "faculty",
  "policies", "funding", "submissions", "notifications", "credentials", "profile",
]);

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

  if (action === "publish_banner" || action === "clear_banner") {
    await refreshOperationalStatus();
    const enabled = action === "publish_banner";
    const title = text(body.title, 120);
    const message = text(body.message, 700);
    const preset = text(body.preset, 60) || null;
    const tone = ["INSTITUTIONAL", "CELEBRATION", "SEASONAL", "IMPORTANT"].includes(String(body.tone))
      ? String(body.tone)
      : "INSTITUTIONAL";
    if (enabled && (title.length < 3 || message.length < 12)) {
      return NextResponse.json({ error: "Add a banner title and a complete student message." }, { status: 400 });
    }
    const now = new Date();
    const status = await db.institutionOperationalSetting.update({
      where: { id: "institution-operations" },
      data: {
        campusBannerEnabled: enabled,
        ...(enabled ? { campusBannerTitle: title, campusBannerMessage: message, campusBannerPreset: preset, campusBannerTone: tone } : {}),
      },
    });
    await db.auditLog.create({
      data: {
        actorId: user.id,
        action: enabled ? "CAMPUS_BANNER_PUBLISHED" : "CAMPUS_BANNER_CLEARED",
        entity: "InstitutionOperationalSetting",
        entityId: status.id,
        detail: enabled ? { title, message, preset, tone } : { previousTitle: status.campusBannerTitle },
      },
    });
    if (enabled && body.sendNotification !== false) {
      after(async () => {
        try {
          const students = await db.user.findMany({ where: { isStudent: true, accountClosedAt: null }, select: { id: true } });
          if (students.length) await db.notification.createMany({
            data: students.map((student) => ({ userId: student.id, type: "SYSTEM" as const, title, body: message, actionUrl: "/university?view=dashboard", dedupeKey: `campus-banner:${now.getTime()}:${student.id}` })),
            skipDuplicates: true,
          });
        } catch { /* The published banner remains authoritative if notification delivery is delayed. */ }
      });
    }
    return NextResponse.json({ status });
  }

  if (action === "set_experience") {
    await refreshOperationalStatus();
    const hiddenNavigationViews: string[] = Array.isArray(body.hiddenNavigationViews)
      ? [...new Set<string>(
          body.hiddenNavigationViews
            .map((item: unknown) => String(item))
            .filter((item: string) => navigationViews.has(item)),
        )]
      : [];
    const courseSelectionEnabled = body.courseSelectionEnabled === true;
    const programSelectionEnabled = body.programSelectionEnabled === true;
    const previous = await db.institutionOperationalSetting.findUniqueOrThrow({ where: { id: "institution-operations" } });
    const selectionChanged = previous.courseSelectionEnabled !== courseSelectionEnabled || previous.programSelectionEnabled !== programSelectionEnabled;
    const now = new Date();
    const status = await db.institutionOperationalSetting.update({
      where: { id: "institution-operations" },
      data: {
        hiddenNavigationViews,
        courseSelectionEnabled,
        programSelectionEnabled,
        ...(selectionChanged ? { experienceUpdatedAt: now } : {}),
      },
    });
    await db.auditLog.create({
      data: {
        actorId: user.id,
        action: "CAMPUS_EXPERIENCE_CONTROLS_UPDATED",
        entity: "InstitutionOperationalSetting",
        entityId: status.id,
        detail: { hiddenNavigationViews, courseSelectionEnabled, programSelectionEnabled, previous: { hiddenNavigationViews: previous.hiddenNavigationViews, courseSelectionEnabled: previous.courseSelectionEnabled, programSelectionEnabled: previous.programSelectionEnabled } },
      },
    });
    if (selectionChanged) {
      const allOpen = courseSelectionEnabled && programSelectionEnabled;
      const title = allOpen ? "Course and program selection is open" : "Your campus account is ready";
      const notice = allOpen
        ? "You can now explore and select Enscript University courses and academic programs."
        : `Welcome to Enscript University. ${!courseSelectionEnabled && !programSelectionEnabled ? "Course and program" : !courseSelectionEnabled ? "Course" : "Program"} selection is not open yet. Please return soon; your student record and campus access remain available.`;
      after(async () => {
        try {
          const students = await db.user.findMany({ where: { isStudent: true, accountClosedAt: null }, select: { id: true } });
          if (students.length) await db.notification.createMany({
            data: students.map((student) => ({ userId: student.id, type: "SYSTEM" as const, title, body: notice, actionUrl: "/university?view=dashboard", dedupeKey: `selection-access:${now.getTime()}:${student.id}` })),
            skipDuplicates: true,
          });
        } catch { /* Access controls do not depend on notification delivery. */ }
      });
    }
    return NextResponse.json({ status });
  }

  if (action === "set_controls") {
    const admissionsMode = body.admissionsPaused === true ? "PAUSED" : "OPEN";
    const enrollmentMode = body.enrollmentPaused === true ? "PAUSED" : "OPEN";
    const learningMode = String(body.learningMode || "ACTIVE");
    const title = text(body.title, 120);
    const publicMessage = text(body.publicMessage, 600);
    const reason = text(body.reason, 500) || "Owner applied immediate campus operating settings.";
    if (!learningModes.has(learningMode)) {
      return NextResponse.json({ error: "Choose a valid campus learning state." }, { status: 400 });
    }
    if (title.length < 3 || publicMessage.length < 12) {
      return NextResponse.json({ error: "Add a public status title and explanation." }, { status: 400 });
    }

    const now = new Date();
    const allOpen = admissionsMode === "OPEN" && enrollmentMode === "OPEN" && learningMode === "ACTIVE";
    const season = learningMode === "MAINTENANCE"
      ? "MAINTENANCE"
      : learningMode === "EMERGENCY_CLOSURE"
        ? "EMERGENCY"
        : "GENERAL";

    const result = await db.$transaction(async (tx) => {
      const existing = await tx.institutionOperationalPeriod.findMany({
        where: { status: { in: ["SCHEDULED", "ACTIVE"] } },
        select: { id: true, status: true },
      });
      const activeIds = existing.filter((period) => period.status === "ACTIVE").map((period) => period.id);
      const scheduledIds = existing.filter((period) => period.status === "SCHEDULED").map((period) => period.id);
      if (activeIds.length) {
        await tx.institutionOperationalPeriod.updateMany({
          where: { id: { in: activeIds }, status: "ACTIVE" },
          data: { endsAt: now },
        });
      }
      if (scheduledIds.length) {
        await tx.institutionOperationalPeriod.updateMany({
          where: { id: { in: scheduledIds }, status: "SCHEDULED" },
          data: { status: "CANCELLED" },
        });
      }
      const manualPeriod = allOpen
        ? null
        : await tx.institutionOperationalPeriod.create({
            data: {
              title,
              publicMessage,
              ownerNote: MANUAL_OPERATION_NOTE,
              admissionsMode,
              enrollmentMode,
              learningMode: learningMode as never,
              season: season as never,
              status: "ACTIVE",
              startsAt: now,
              endsAt: manualOperationEnd(),
              activatedAt: now,
              createdById: user.id,
            },
          });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "CAMPUS_CONTROLS_APPLIED",
          entity: "InstitutionOperationalSetting",
          entityId: manualPeriod?.id || "institution-operations",
          detail: {
            reason,
            admissionsMode,
            enrollmentMode,
            learningMode,
            title,
            publicMessage,
            allOpen,
            endedActivePeriods: activeIds,
            cancelledScheduledPeriods: scheduledIds,
          },
        },
      });
      return { manualPeriod, ended: activeIds.length, cancelled: scheduledIds.length };
    });

    await refreshOperationalStatus();
    const status = await campusStatus();
    const notificationKey = result.manualPeriod?.id || `open-${now.getTime()}`;
    after(async () => {
      try {
        const students = await db.user.findMany({
          where: { isStudent: true, accountClosedAt: null },
          select: { id: true },
        });
        if (students.length) {
          await db.notification.createMany({
            data: students.map((student) => ({
              userId: student.id,
              type: "SYSTEM" as const,
              title: allOpen ? "Campus services restored" : title,
              body: allOpen
                ? "Admissions, enrollment, and learning services are available."
                : `${publicMessage} These settings remain active until changed by the owner.`,
              actionUrl: "/campus-status",
              dedupeKey: `campus-controls:${notificationKey}:${student.id}`,
            })),
            skipDuplicates: true,
          });
        }
      } catch {
        // Campus state is authoritative even if a notice must be retried.
      }
    });
    return NextResponse.json({ status, allOpen, ...result });
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
