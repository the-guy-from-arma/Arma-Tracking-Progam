import { db } from "@/lib/db";

export const WITHDRAWAL_RETURN_PERCENT = 30;
export const WITHDRAWAL_PENALTY_BPS = 500;
export const MAX_WITHDRAWAL_PENALTY_BPS = 2500;
export const MIN_RENEWAL_MULTIPLIER_BPS = 6000;
export const CONTINUING_GRADE = 70;

export function calculateFundingStanding(input: {
  scores: number[];
  withdrawalCount: number;
  ownerOverrideMultiplierBps?: number | null;
}) {
  const finalizedGradeCount = input.scores.length;
  const gradeAverage = finalizedGradeCount ? input.scores.reduce((sum, score) => sum + score, 0) / finalizedGradeCount : 0;
  const withdrawalPenaltyBps = Math.min(MAX_WITHDRAWAL_PENALTY_BPS, input.withdrawalCount * WITHDRAWAL_PENALTY_BPS);
  const gradePenaltyBps = finalizedGradeCount < 2 || gradeAverage >= CONTINUING_GRADE ? 0 : gradeAverage >= 60 ? 1000 : gradeAverage >= 50 ? 1500 : 2500;
  const calculatedMultiplier = Math.max(MIN_RENEWAL_MULTIPLIER_BPS, 10000 - withdrawalPenaltyBps - gradePenaltyBps);
  const renewalMultiplierBps = input.ownerOverrideMultiplierBps == null ? calculatedMultiplier : Math.max(MIN_RENEWAL_MULTIPLIER_BPS, Math.min(10000, input.ownerOverrideMultiplierBps));
  const academicHold = finalizedGradeCount >= 2 && gradeAverage < CONTINUING_GRADE && input.ownerOverrideMultiplierBps == null;
  const status = academicHold ? "REVIEW_REQUIRED" as const : withdrawalPenaltyBps || gradePenaltyBps ? "SUPPORT" as const : "GOOD" as const;
  return { finalizedGradeCount, gradeAverage, withdrawalPenaltyBps, gradePenaltyBps, renewalMultiplierBps, academicHold, status };
}

export async function getOrCreateFundingStanding(userId: string) {
  return db.studentFundingStanding.upsert({ where: { userId }, update: {}, create: { userId } });
}

export async function recalculateFundingStanding(userId: string) {
  const [current, withdrawals, decisions] = await Promise.all([
    getOrCreateFundingStanding(userId),
    db.courseEnrollment.count({ where: { userId, status: "WITHDRAWN" } }),
    db.aiGradeDecision.findMany({
      where: {
        status: "AUTO_FINALIZED",
        submission: { studentId: userId, appeals: { none: { status: { in: ["SUBMITTED", "IN_REVIEW"] } } } },
      },
      select: { totalScore: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const calculated = calculateFundingStanding({ scores: decisions.map((item) => item.totalScore), withdrawalCount: withdrawals, ownerOverrideMultiplierBps: current.ownerOverrideMultiplierBps });
  const standing = await db.studentFundingStanding.update({
    where: { userId },
    data: { ...calculated, withdrawalCount: withdrawals, lastGradeAt: decisions[0]?.createdAt || null },
  });
  return standing;
}

export async function withdrawFromCourse(userId: string, enrollmentId: string, reason: string) {
  const enrollment = await db.courseEnrollment.findFirst({
    where: { id: enrollmentId, userId },
    include: { course: true, user: { select: { grantBalanceCents: true } } },
  });
  if (!enrollment) throw new Error("Enrollment not found.");
  if (enrollment.status === "WITHDRAWN") return { enrollment, standing: await recalculateFundingStanding(userId), alreadyProcessed: true };
  if (enrollment.status !== "ACTIVE" || enrollment.completedAt) throw new Error("Only an active, incomplete course can be withdrawn.");
  const activeSubmission = await db.courseSubmission.findFirst({
    where: { courseId: enrollment.courseId, studentId: userId, status: { in: ["SUBMITTED", "PENDING_AI_REVIEW", "AI_REVIEWING", "AI_EXCEPTION", "IN_REVIEW", "APPROVED", "APPEALED"] } },
    select: { id: true },
  });
  if (activeSubmission) throw new Error("This course has assessment work in review. Resolve or appeal that assessment before withdrawing.");

  const allocation = await db.grantLedger.findFirst({
    where: { userId, courseId: enrollment.courseId, type: "COURSE_ALLOCATION" },
    orderBy: { createdAt: "desc" },
  });
  const allocatedCents = allocation ? Math.abs(allocation.amountCents) : enrollment.course.serviceValueCents;
  const refundCents = Math.round(allocatedCents * (WITHDRAWAL_RETURN_PERCENT / 100));
  const idempotencyKey = `withdrawal-refund:${enrollment.id}`;

  await db.$transaction(async (tx) => {
    const alreadyRefunded = await tx.grantLedger.findUnique({ where: { idempotencyKey } });
    if (alreadyRefunded) return;
    await tx.courseEnrollment.update({ where: { id: enrollment.id }, data: { status: "WITHDRAWN", withdrawnAt: new Date(), withdrawalReason: reason, refundCents } });
    await tx.user.update({ where: { id: userId }, data: { grantBalanceCents: { increment: refundCents } } });
    await tx.grantLedger.create({
      data: { userId, courseId: enrollment.courseId, type: "WITHDRAWAL_REFUND", amountCents: refundCents, description: `${enrollment.course.code} withdrawal return (30% of sponsored allocation)`, idempotencyKey, metadata: { allocatedCents, refundPercent: WITHDRAWAL_RETURN_PERCENT, nonCash: true } },
    });
    await tx.notification.create({
      data: { userId, type: "ACADEMIC", title: `${enrollment.course.code} withdrawal recorded`, body: `A 30% internal sponsorship return was deposited. Your next-term award rate will be reduced by 5 percentage points; visit Student Center for the recovery policy.`, actionUrl: "/university?view=student-center", dedupeKey: `${idempotencyKey}:notice` },
    });
    await tx.auditLog.create({ data: { actorId: userId, action: "COURSE_WITHDRAWN", entity: "CourseEnrollment", entityId: enrollment.id, detail: { courseId: enrollment.courseId, allocatedCents, refundCents, refundPercent: WITHDRAWAL_RETURN_PERCENT } } });
  });
  const standing = await recalculateFundingStanding(userId);
  return { enrollment: await db.courseEnrollment.findUniqueOrThrow({ where: { id: enrollment.id }, include: { course: true } }), standing, alreadyProcessed: false };
}
