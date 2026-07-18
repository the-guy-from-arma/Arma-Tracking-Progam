import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export type CampusCapability =
  | "ADMISSIONS_SUBMIT"
  | "ENROLLMENT"
  | "LEARNING_READ"
  | "LEARNING_WRITE"
  | "SUBMISSION"
  | "GRADING_FINALIZE"
  | "WITHDRAWAL"
  | "CREDENTIAL";

const OPEN_STATUS = {
  admissionsMode: "OPEN" as const,
  enrollmentMode: "OPEN" as const,
  learningMode: "ACTIVE" as const,
  publicTitle: "Campus is open",
  publicMessage: "Admissions, enrollment, and learning services are available.",
  reopensAt: null,
  season: "GENERAL" as const,
  activePeriodId: null,
};

async function notifyStudents(key: string, title: string, body: string) {
  try {
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
        actionUrl: "/university?view=dashboard",
        dedupeKey: `${key}:${student.id}`,
      })),
      skipDuplicates: true,
    });
  } catch {
    // A notification delivery problem must never prevent the operating
    // calendar from activating or the public campus-status page from loading.
  }
}

async function completePeriod(periodId: string) {
  const period = await db.institutionOperationalPeriod.findUnique({ where: { id: periodId } });
  if (!period || period.status === "COMPLETED" || period.status === "CANCELLED") return;
  const durationMs = Math.max(0, period.endsAt.getTime() - period.startsAt.getTime());
  const durationDays = Math.ceil(durationMs / 86_400_000);

  const completed = await db.$transaction(async (tx) => {
    const claimed = await tx.institutionOperationalPeriod.updateMany({
      where: { id: periodId, status: "ACTIVE", deadlineExtensionAppliedAt: null },
      data: { deadlineExtensionAppliedAt: new Date() },
    });
    if (!claimed.count) return false;
    if (period.learningMode === "ACADEMIC_BREAK" && !period.deadlineExtensionAppliedAt && durationMs > 0) {
      const enrollments = await tx.courseEnrollment.findMany({
        where: { status: "ACTIVE", expectedEndAt: { not: null } },
        select: { id: true, expectedEndAt: true },
      });
      const terms = await tx.studentFundingTerm.findMany({
        where: { status: { in: ["ACTIVE", "UPCOMING"] } },
        select: { id: true, endsAt: true },
      });
      for (const enrollment of enrollments) {
        const previousAt = enrollment.expectedEndAt!;
        const adjustedAt = new Date(previousAt.getTime() + durationMs);
        await tx.courseEnrollment.update({
          where: { id: enrollment.id },
          data: { expectedEndAt: adjustedAt, pausedDays: { increment: durationDays } },
        });
        await tx.operationalDeadlineAdjustment.upsert({
          where: { periodId_entityType_entityId: { periodId, entityType: "CourseEnrollment", entityId: enrollment.id } },
          update: {},
          create: { periodId, entityType: "CourseEnrollment", entityId: enrollment.id, previousAt, adjustedAt },
        });
      }
      for (const term of terms) {
        const adjustedAt = new Date(term.endsAt.getTime() + durationMs);
        await tx.studentFundingTerm.update({ where: { id: term.id }, data: { endsAt: adjustedAt } });
        await tx.operationalDeadlineAdjustment.upsert({
          where: { periodId_entityType_entityId: { periodId, entityType: "StudentFundingTerm", entityId: term.id } },
          update: {},
          create: { periodId, entityType: "StudentFundingTerm", entityId: term.id, previousAt: term.endsAt, adjustedAt },
        });
      }
    }
    await tx.institutionOperationalPeriod.update({
      where: { id: periodId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return true;
  });
  if (completed) await notifyStudents(`campus-period-ended:${periodId}`, "Campus learning has reopened", "The scheduled campus period has ended. Academic services are available again, and affected dates have been adjusted.");
}

export async function refreshOperationalStatus() {
  const now = new Date();
  const expired = await db.institutionOperationalPeriod.findMany({
    where: { status: "ACTIVE", endsAt: { lte: now } },
    select: { id: true },
  });
  for (const period of expired) await completePeriod(period.id);

  const active = await db.institutionOperationalPeriod.findFirst({
    where: { status: { in: ["SCHEDULED", "ACTIVE"] }, startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { startsAt: "desc" },
  });

  if (active) {
    if (active.status === "SCHEDULED") {
      const claimed = await db.institutionOperationalPeriod.updateMany({
        where: { id: active.id, status: "SCHEDULED" },
        data: { status: "ACTIVE", activatedAt: now },
      });
      if (claimed.count) {
        await notifyStudents(`campus-period-started:${active.id}`, active.title, `${active.publicMessage} Scheduled reopening: ${active.endsAt.toLocaleString("en-US", { timeZone: "America/New_York" })}.`);
      }
    }
    return db.institutionOperationalSetting.upsert({
      where: { id: "institution-operations" },
      update: {
        admissionsMode: active.admissionsMode,
        enrollmentMode: active.enrollmentMode,
        learningMode: active.learningMode,
        publicTitle: active.title,
        publicMessage: active.publicMessage,
        reopensAt: active.endsAt,
        season: active.season,
        activePeriodId: active.id,
      },
      create: {
        id: "institution-operations",
        admissionsMode: active.admissionsMode,
        enrollmentMode: active.enrollmentMode,
        learningMode: active.learningMode,
        publicTitle: active.title,
        publicMessage: active.publicMessage,
        reopensAt: active.endsAt,
        season: active.season,
        activePeriodId: active.id,
      },
    });
  }

  return db.institutionOperationalSetting.upsert({
    where: { id: "institution-operations" },
    update: OPEN_STATUS,
    create: { id: "institution-operations", ...OPEN_STATUS },
  });
}

export function operationalAvailability(status: Awaited<ReturnType<typeof refreshOperationalStatus>>) {
  const academicWrites = status.learningMode === "ACTIVE";
  return {
    admissions: status.admissionsMode === "OPEN",
    enrollment: status.enrollmentMode === "OPEN" && academicWrites,
    lessonReading: status.learningMode === "ACTIVE" || status.learningMode === "ACADEMIC_BREAK",
    lessonProgress: academicWrites,
    quizzes: academicWrites,
    submissions: academicWrites,
    gradingFinalization: academicWrites,
    withdrawals: academicWrites,
    credentials: academicWrites,
    messages: status.learningMode !== "EMERGENCY_CLOSURE",
    records: true,
    policies: true,
  };
}

export async function campusStatus() {
  const status = await refreshOperationalStatus();
  return { ...status, availability: operationalAvailability(status), statusUrl: "/campus-status" };
}

export async function publicCampusStatus() {
  try {
    return await campusStatus();
  } catch {
    const fallback = {
      id: "institution-operations",
      admissionsMode: "PAUSED" as const,
      enrollmentMode: "PAUSED" as const,
      learningMode: "MAINTENANCE" as const,
      timezone: "America/New_York",
      publicTitle: "Campus status is being refreshed",
      publicMessage:
        "The university could not confirm the operating calendar. Academic changes are temporarily paused while records, policies, and support remain available.",
      reopensAt: null,
      season: "MAINTENANCE" as const,
      activePeriodId: null,
      updatedAt: new Date(),
    };
    return {
      ...fallback,
      availability: operationalAvailability(fallback),
      statusUrl: "/campus-status",
      statusDegraded: true,
    };
  }
}

export async function campusRestriction(capability: CampusCapability) {
  const status = await campusStatus();
  const blocked =
    (capability === "ADMISSIONS_SUBMIT" && !status.availability.admissions) ||
    (capability === "ENROLLMENT" && !status.availability.enrollment) ||
    (capability === "LEARNING_READ" && !status.availability.lessonReading) ||
    (capability === "LEARNING_WRITE" && !status.availability.lessonProgress) ||
    (capability === "SUBMISSION" && !status.availability.submissions) ||
    (capability === "GRADING_FINALIZE" && !status.availability.gradingFinalization) ||
    (capability === "WITHDRAWAL" && !status.availability.withdrawals) ||
    (capability === "CREDENTIAL" && !status.availability.credentials);
  return blocked ? status : null;
}

export async function campusRestrictionResponse(capability: CampusCapability) {
  const status = await campusRestriction(capability);
  if (!status) return null;
  return NextResponse.json(
    {
      error: status.publicMessage,
      code: "CAMPUS_OPERATION_RESTRICTED",
      capability,
      mode: status.learningMode,
      admissionsMode: status.admissionsMode,
      enrollmentMode: status.enrollmentMode,
      reopensAt: status.reopensAt,
      statusUrl: status.statusUrl,
    },
    { status: 423 },
  );
}
