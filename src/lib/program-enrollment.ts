import { db } from "@/lib/db";
import { getCompletedCourseIds, getProgramAudit } from "@/lib/academic-progress";
import { trackingEvent } from "@/lib/application-tracking";
import { ensureCourseFunding } from "@/lib/funding";
import { ensureStudentFacultyNetwork } from "@/lib/faculty-network";

const DAY_MS = 86_400_000;

type ProgramCourse = {
  id: string;
  code: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  estimatedDays: number;
  serviceValueCents: number;
};

async function registerProgramCourse(input: {
  userId: string;
  actorId: string;
  programId: string;
  programCode: string;
  course: ProgramCourse;
  expectedEndAt: Date;
}) {
  const existing = await db.courseEnrollment.findUnique({
    where: {
      courseId_userId: {
        courseId: input.course.id,
        userId: input.userId,
      },
    },
  });
  if (existing) {
    return {
      state: existing.status === "WITHDRAWN" ? "WITHDRAWN" : "EXISTING",
      enrollment: existing,
      allocatedCents: 0,
    } as const;
  }

  await ensureCourseFunding(
    input.userId,
    input.course.id,
    input.course.serviceValueCents,
  );

  return db.$transaction(async (tx) => {
    // Program activation is retry-safe. A concurrent request that already
    // registered the course must never create a second allocation.
    const concurrent = await tx.courseEnrollment.findUnique({
      where: {
        courseId_userId: {
          courseId: input.course.id,
          userId: input.userId,
        },
      },
    });
    if (concurrent) {
      return {
        state:
          concurrent.status === "WITHDRAWN" ? "WITHDRAWN" : "EXISTING",
        enrollment: concurrent,
        allocatedCents: 0,
      } as const;
    }

    const current = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { grantBalanceCents: true },
    });
    if (current.grantBalanceCents < input.course.serviceValueCents) {
      throw new Error(
        `Sponsored funding could not be reconciled for ${input.course.code}. No student payment is required.`,
      );
    }

    const enrollment = await tx.courseEnrollment.create({
      data: {
        courseId: input.course.id,
        userId: input.userId,
        expectedEndAt: input.expectedEndAt,
      },
    });
    const grantBalanceCents =
      current.grantBalanceCents - input.course.serviceValueCents;
    await tx.user.update({
      where: { id: input.userId },
      data: { grantBalanceCents },
    });

    const sources = await tx.fundingAward.findMany({
      where: {
        userId: input.userId,
        status: { in: ["AVAILABLE", "PARTIALLY_USED", "ADJUSTED"] },
        remainingAmountCents: { gt: 0 },
      },
      orderBy: [{ expiresAt: "asc" }, { awardedAt: "asc" }],
    });
    let required = input.course.serviceValueCents;
    let primarySourceId: string | null = null;
    for (const source of sources) {
      if (!required) break;
      const used = Math.min(required, source.remainingAmountCents);
      if (!primarySourceId) primarySourceId = source.id;
      const remaining = source.remainingAmountCents - used;
      await tx.fundingAward.update({
        where: { id: source.id },
        data: {
          remainingAmountCents: remaining,
          status: remaining === 0 ? "FULLY_USED" : "PARTIALLY_USED",
        },
      });
      required -= used;
    }
    if (required) {
      throw new Error(
        `Funding source reconciliation failed for ${input.course.code}. Program registration can be retried safely.`,
      );
    }

    await tx.grantLedger.create({
      data: {
        userId: input.userId,
        fundingAwardId: primarySourceId,
        type: "COURSE_ALLOCATION",
        amountCents: -input.course.serviceValueCents,
        description: `${input.course.code} ${input.course.title} sponsored service allocation`,
        courseId: input.course.id,
        idempotencyKey: `allocation:${input.userId}:${input.course.id}`,
        runningBalanceCents: grantBalanceCents,
        publicReason: "PROGRAM_COURSE_REGISTRATION",
        metadata: {
          programId: input.programId,
          programCode: input.programCode,
          studentResponsibilityCents: 0,
          nonCash: true,
          allocationMethod: "FIFO_EXPIRATION",
        },
      },
    });
    await tx.studentActivityEvent.create({
      data: {
        studentId: input.userId,
        actorId: input.actorId,
        type: "ENROLLMENT",
        title: `Registered in ${input.course.code}`,
        detail: `${input.course.title} · Required by ${input.programCode}`,
        entity: "CourseEnrollment",
        entityId: enrollment.id,
        metadata: { programId: input.programId },
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "PROGRAM_COURSE_REGISTERED",
        entity: "Course",
        entityId: input.course.id,
        detail: {
          studentId: input.userId,
          programId: input.programId,
          serviceValueCents: input.course.serviceValueCents,
          studentDueCents: 0,
        },
      },
    });

    return {
      state: "REGISTERED",
      enrollment,
      allocatedCents: input.course.serviceValueCents,
    } as const;
  });
}

export async function activateAcademicProgram(input: {
  userId: string;
  actorId?: string;
  programId: string;
}) {
  const actorId = input.actorId || input.userId;
  const [program, audit, completedCourseIds] = await Promise.all([
    db.academicProgram.findFirst({
      where: { id: input.programId, active: true },
      include: {
        requirements: {
          include: { course: true },
          orderBy: [{ termNumber: "asc" }, { sequence: "asc" }],
        },
      },
    }),
    getProgramAudit(input.userId, input.programId),
    getCompletedCourseIds(input.userId),
  ]);
  if (!program) throw new Error("PROGRAM_NOT_FOUND");
  if (!audit?.eligible) throw new Error(audit?.blocker || "PROGRAM_PREREQUISITE_REQUIRED");
  if (!program.requirements.length) throw new Error("PROGRAM_CURRICULUM_EMPTY");

  const unavailable = program.requirements.filter(
    (requirement) => requirement.course.status !== "PUBLISHED",
  );
  if (unavailable.length) {
    throw new Error(
      `The program curriculum is not ready: ${unavailable.map((item) => item.course.code).join(", ")}.`,
    );
  }

  const priorEnrollment = await db.programEnrollment.findUnique({
    where: {
      programId_userId: {
        programId: input.programId,
        userId: input.userId,
      },
    },
  });

  const programEnrollment = await db.$transaction(async (tx) => {
    const legacyApplication = await tx.programApplication.findUnique({
      where: {
        programId_userId: {
          programId: input.programId,
          userId: input.userId,
        },
      },
    });
    if (
      legacyApplication &&
      ["SUBMITTED", "WAITLISTED"].includes(legacyApplication.status)
    ) {
      await tx.programApplication.update({
        where: { id: legacyApplication.id },
        data: {
          status: "ADMITTED",
          decisionNote: "Superseded by direct student enrollment confirmation.",
          decidedAt: new Date(),
        },
      });
      const trackers = await tx.applicationTracking.findMany({
        where: {
          programApplicationId: legacyApplication.id,
          status: { in: ["OPEN", "IN_REVIEW"] },
        },
      });
      for (const tracker of trackers) {
        await tx.applicationTracking.update({
          where: { id: tracker.id },
          data: {
            status: "CLOSED",
            outcome: "DIRECT_ENROLLMENT",
            closedAt: new Date(),
            statusHistory: [
              ...(Array.isArray(tracker.statusHistory)
                ? tracker.statusHistory
                : []),
              trackingEvent(
                "ADMITTED",
                "Program activated by direct student confirmation",
              ),
              trackingEvent(
                "CLOSED",
                "Program applications are no longer required",
              ),
            ],
          },
        });
      }
    }

    return tx.programEnrollment.upsert({
      where: {
        programId_userId: {
          programId: input.programId,
          userId: input.userId,
        },
      },
      update: {
        status: "ACTIVE",
        creditsEarned: audit.creditsApplied,
        programApplicationId: legacyApplication?.id,
      },
      create: {
        programId: input.programId,
        userId: input.userId,
        creditsEarned: audit.creditsApplied,
        programApplicationId: legacyApplication?.id,
      },
    });
  });

  const registered: string[] = [];
  const retained: string[] = [];
  const credited: string[] = [];
  const withdrawn: string[] = [];
  let allocatedCents = 0;
  let elapsedDays = 0;

  for (const requirement of program.requirements) {
    const course = requirement.course;
    if (completedCourseIds.has(course.id)) {
      credited.push(course.code);
      continue;
    }
    elapsedDays += course.estimatedDays;
    const result = await registerProgramCourse({
      userId: input.userId,
      actorId,
      programId: program.id,
      programCode: program.code,
      course,
      expectedEndAt: new Date(Date.now() + elapsedDays * DAY_MS),
    });
    if (result.state === "REGISTERED") {
      registered.push(course.code);
      allocatedCents += result.allocatedCents;
    } else if (result.state === "WITHDRAWN") {
      withdrawn.push(course.code);
    } else {
      retained.push(course.code);
    }
  }

  const courseSummary = [
    registered.length
      ? `${registered.length} required course${registered.length === 1 ? "" : "s"} registered`
      : null,
    retained.length
      ? `${retained.length} existing enrollment${retained.length === 1 ? "" : "s"} retained`
      : null,
    credited.length
      ? `${credited.length} completed course${credited.length === 1 ? "" : "s"} credited`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const summaryText = courseSummary || "Your curriculum is already registered";
  const attention = withdrawn.length
    ? ` ${withdrawn.join(", ")} was previously withdrawn and requires Student Center advising before re-entry.`
    : "";

  await db.$transaction(async (tx) => {
    if (!priorEnrollment || priorEnrollment.status !== "ACTIVE") {
      await tx.studentActivityEvent.create({
        data: {
          studentId: input.userId,
          actorId,
          type: "ENROLLMENT",
          title: "Academic pathway activated",
          detail: program.title,
          entity: "ProgramEnrollment",
          entityId: programEnrollment.id,
          metadata: {
            programCode: program.code,
            creditsApplied: audit.creditsApplied,
            coursesRegistered: registered.length,
          },
        },
      });
    }
    await tx.notification.upsert({
      where: { dedupeKey: `program-enrolled:${input.userId}:${program.id}` },
      update: {
        readAt: null,
        title: `${program.title} is ready`,
        body: `${summaryText}.${attention}`,
      },
      create: {
        userId: input.userId,
        type: "ACADEMIC",
        title: `${program.title} is ready`,
        body: `${summaryText}.${attention}`,
        actionUrl: "/university?view=learning",
        dedupeKey: `program-enrolled:${input.userId}:${program.id}`,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: priorEnrollment
          ? "PROGRAM_CURRICULUM_SYNCHRONIZED"
          : "PROGRAM_ENROLLED",
        entity: "AcademicProgram",
        entityId: program.id,
        detail: {
          studentId: input.userId,
          creditsApplied: audit.creditsApplied,
          allocationMethod: "AUTOMATIC_REQUIRED_COURSES",
          registered,
          retained,
          credited,
          withdrawn,
          allocatedCents,
          studentDueCents: 0,
          fundingDisclosureVersion: "SPONSORED_LEARNING_CONFIRMATION_V1",
          fundingAcknowledged: true,
          refundPolicyAcknowledged: true,
        },
      },
    });
  });

  await ensureStudentFacultyNetwork(input.userId);

  return {
    enrollment: programEnrollment,
    program: { id: program.id, code: program.code, title: program.title },
    curriculum: {
      required: program.requirements.length,
      registered,
      retained,
      credited,
      withdrawn,
    },
    allocatedCents,
    studentDueCents: 0,
  };
}
