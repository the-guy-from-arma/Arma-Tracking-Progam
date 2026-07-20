import { db } from "@/lib/db";
import { getCompletedCourseIds, getProgramAudit } from "@/lib/academic-progress";
import { fundingReference } from "@/lib/funding-awards";
import { recalculateFundingStanding } from "@/lib/funding-standing";
import { activateAcademicProgram } from "@/lib/program-enrollment";

export const PROGRAM_CHANGE_POLICY = {
  id: "enscript-program-change-2026",
  name: "Academic Program Change Schedule 2026",
  graceHours: 72,
  tiers: [
    { throughHours: 336, penaltyBps: 100 },
    { throughHours: 720, penaltyBps: 200 },
    { throughHours: null, penaltyBps: 300 },
  ],
} as const;

function programPenalty(elapsedHours: number) {
  if (elapsedHours <= PROGRAM_CHANGE_POLICY.graceHours) return 0;
  return PROGRAM_CHANGE_POLICY.tiers.find(
    (tier) => tier.throughHours == null || elapsedHours <= tier.throughHours,
  )!.penaltyBps;
}

async function programChangeContext(
  userId: string,
  enrollmentId: string,
  targetProgramId?: string,
) {
  const enrollment = await db.programEnrollment.findFirst({
    where: { id: enrollmentId, userId },
    include: {
      program: {
        include: {
          requirements: {
            include: { course: { select: { id: true, code: true, title: true, serviceValueCents: true } } },
          },
        },
      },
    },
  });
  if (!enrollment) throw new Error("Program enrollment not found.");
  if (enrollment.status !== "ACTIVE" || enrollment.completedAt) {
    throw new Error("Only an active, incomplete program can be changed or withdrawn.");
  }
  if (targetProgramId === enrollment.programId) {
    throw new Error("Choose a different program before requesting a change quote.");
  }

  const now = new Date();
  const elapsedHours = Math.max(
    0,
    (now.getTime() - enrollment.enrolledAt.getTime()) / 3_600_000,
  );
  const penaltyBps = programPenalty(elapsedHours);
  const sourceAudit = await getProgramAudit(userId, enrollment.programId);
  const courseEnrollments = await db.courseEnrollment.findMany({
    where: { userId },
    select: { courseId: true, status: true },
  });
  const activeCourseIds = new Set(
    courseEnrollments
      .filter((item) => item.status === "ACTIVE")
      .map((item) => item.courseId),
  );

  let target: {
    id: string;
    code: string;
    title: string;
    newAllocationCents: number;
    newCourseCodes: string[];
  } | null = null;
  let targetCourseIds = new Set<string>();
  if (targetProgramId) {
    const [program, targetAudit, completedCourseIds] = await Promise.all([
      db.academicProgram.findFirst({
        where: { id: targetProgramId, active: true },
        include: {
          requirements: {
            include: { course: { select: { id: true, code: true, title: true, serviceValueCents: true, status: true } } },
          },
        },
      }),
      getProgramAudit(userId, targetProgramId),
      getCompletedCourseIds(userId),
    ]);
    if (!program) throw new Error("The selected replacement program is unavailable.");
    if (!targetAudit?.eligible) {
      throw new Error(targetAudit?.blocker || "The selected program's prerequisite pathway is incomplete.");
    }
    const unavailable = program.requirements.filter((item) => item.course.status !== "PUBLISHED");
    if (unavailable.length) throw new Error("The selected program curriculum is not ready for activation.");
    targetCourseIds = new Set(program.requirements.map((item) => item.courseId));
    const existingCourseIds = new Set(courseEnrollments.map((item) => item.courseId));
    const newCourses = program.requirements.filter(
      (item) => !completedCourseIds.has(item.courseId) && !existingCourseIds.has(item.courseId),
    );
    target = {
      id: program.id,
      code: program.code,
      title: program.title,
      newAllocationCents: newCourses.reduce(
        (total, item) => total + item.course.serviceValueCents,
        0,
      ),
      newCourseCodes: newCourses.map((item) => item.course.code),
    };
  }

  const retainedActiveCourses = enrollment.program.requirements
    .filter(
      (item) =>
        activeCourseIds.has(item.courseId) &&
        (!targetProgramId || !targetCourseIds.has(item.courseId)),
    )
    .map((item) => ({ code: item.course.code, title: item.course.title }));
  const progressPercent = sourceAudit?.progressPercent || 0;
  return {
    enrollment,
    quote: {
      policyId: PROGRAM_CHANGE_POLICY.id,
      policyName: PROGRAM_CHANGE_POLICY.name,
      graceHours: PROGRAM_CHANGE_POLICY.graceHours,
      elapsedHours: Math.round(elapsedHours * 10) / 10,
      progressPercent,
      penaltyBps,
      penaltyPercent: penaltyBps / 100,
      currentBalanceImpactCents: 0,
      target,
      retainedActiveCourses,
      completedCreditsPreserved: true,
      explanation:
        penaltyBps === 0
          ? "This change is within 72 hours. It creates no program-change funding adjustment."
          : `This change is outside the 72-hour grace period. The next sponsored-learning award rate is reduced by ${penaltyBps / 100} percentage point${penaltyBps === 100 ? "" : "s"}; today's available balance is not reduced by the change itself.`,
      coursePolicyNotice:
        "Program withdrawal does not withdraw active courses. Each course remains available and keeps its existing allocation unless you request a separate course-withdrawal quote.",
      calculatedAt: now.toISOString(),
    },
  };
}

export async function quoteProgramChange(
  userId: string,
  enrollmentId: string,
  targetProgramId?: string,
) {
  return programChangeContext(userId, enrollmentId, targetProgramId);
}

export async function withdrawAcademicProgram(input: {
  userId: string;
  enrollmentId: string;
  reason: string;
  targetProgramId?: string;
  quoteOverride?: Awaited<ReturnType<typeof quoteProgramChange>>["quote"];
}) {
  const existing = await db.programEnrollment.findFirst({
    where: { id: input.enrollmentId, userId: input.userId },
    include: { program: true },
  });
  if (!existing) throw new Error("Program enrollment not found.");
  if (existing.status === "WITHDRAWN") {
    return {
      enrollment: existing,
      standing: await recalculateFundingStanding(input.userId),
      alreadyProcessed: true,
    };
  }
  const { enrollment, quote: recalculatedQuote } = await programChangeContext(
    input.userId,
    input.enrollmentId,
    input.targetProgramId,
  );
  const quote = input.quoteOverride || recalculatedQuote;
  const idempotencyKey = `program-change:${enrollment.id}:${input.targetProgramId || "withdraw"}`;
  await db.$transaction(async (tx) => {
    const locked = await tx.programEnrollment.updateMany({
      where: { id: enrollment.id, status: "ACTIVE", withdrawnAt: null },
      data: {
        status: "WITHDRAWN",
        withdrawnAt: new Date(),
        withdrawalReason: input.reason,
        changeTargetProgramId: input.targetProgramId || null,
        programChangePenaltyBps: quote.penaltyBps,
        programChangePolicySnapshot: quote,
      },
    });
    if (locked.count !== 1) return;
    const account = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { grantBalanceCents: true },
    });
    await tx.grantLedger.upsert({
      where: { idempotencyKey },
      update: {},
      create: {
        userId: input.userId,
        actorId: input.userId,
        type: "FUNDING_REDUCTION",
        amountCents: 0,
        description: quote.penaltyBps
          ? `${enrollment.program.code} program change renewal adjustment (${quote.penaltyPercent} percentage points)`
          : `${enrollment.program.code} program change within 72-hour grace period`,
        idempotencyKey,
        referenceNumber: fundingReference("EPC"),
        runningBalanceCents: account.grantBalanceCents,
        publicReason: "PROGRAM_CHANGE",
        metadata: { ...quote, nonCash: true, currentBalanceChanged: false },
      },
    });
    await tx.studentActivityEvent.create({
      data: {
        studentId: input.userId,
        actorId: input.userId,
        type: "ENROLLMENT",
        title: input.targetProgramId
          ? `Changed from ${enrollment.program.code}`
          : `Withdrew from ${enrollment.program.code}`,
        detail: `${quote.penaltyPercent} percentage-point renewal adjustment; completed credits and active courses preserved.`,
        entity: "ProgramEnrollment",
        entityId: enrollment.id,
        metadata: { targetProgramId: input.targetProgramId || null, quote },
      },
    });
    await tx.notification.upsert({
      where: { dedupeKey: `${idempotencyKey}:notice` },
      update: {},
      create: {
        userId: input.userId,
        type: "ACADEMIC",
        title: input.targetProgramId
          ? "Academic program change recorded"
          : "Program withdrawal recorded",
        body: `${quote.explanation} Completed credit and active courses were preserved.`,
        actionUrl: "/university?view=student-center&center=enrollment",
        dedupeKey: `${idempotencyKey}:notice`,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.userId,
        action: input.targetProgramId ? "PROGRAM_CHANGED" : "PROGRAM_WITHDRAWN",
        entity: "ProgramEnrollment",
        entityId: enrollment.id,
        detail: { reason: input.reason, targetProgramId: input.targetProgramId || null, quote },
      },
    });
  });
  return {
    enrollment: await db.programEnrollment.findUniqueOrThrow({
      where: { id: enrollment.id },
      include: { program: true },
    }),
    standing: await recalculateFundingStanding(input.userId),
    quote,
    alreadyProcessed: false,
  };
}

export async function changeAcademicProgram(input: {
  userId: string;
  actorId?: string;
  enrollmentId: string;
  targetProgramId: string;
  reason: string;
}) {
  const quote = await quoteProgramChange(
    input.userId,
    input.enrollmentId,
    input.targetProgramId,
  );
  const activated = await activateAcademicProgram({
    userId: input.userId,
    actorId: input.actorId || input.userId,
    programId: input.targetProgramId,
  });
  const withdrawn = await withdrawAcademicProgram({
    userId: input.userId,
    enrollmentId: input.enrollmentId,
    targetProgramId: input.targetProgramId,
    reason: input.reason,
    quoteOverride: quote.quote,
  });
  return { ...activated, previousProgram: withdrawn.enrollment, changeQuote: quote.quote };
}
