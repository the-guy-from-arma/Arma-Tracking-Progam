import { db } from "@/lib/db";
import { fundingReference } from "@/lib/funding-awards";

export const MAX_WITHDRAWAL_PENALTY_BPS = 2500;
export const MIN_RENEWAL_MULTIPLIER_BPS = 6000;
export const CONTINUING_GRADE = 70;
export const DEFAULT_POLICY = {
  name: "Sponsored Learning Withdrawal Schedule 2026",
  timeTiers: [{ throughHours: 24, refundPercent: 100 }, { throughHours: 72, refundPercent: 80 }, { throughHours: 168, refundPercent: 60 }, { throughHours: 336, refundPercent: 40 }, { throughHours: null, refundPercent: 20 }],
  progressTiers: [{ throughPercent: 25, refundPercent: 80 }, { throughPercent: 40, refundPercent: 60 }, { throughPercent: 60, refundPercent: 40 }, { throughPercent: 80, refundPercent: 20 }, { throughPercent: 100, refundPercent: 0 }],
  penaltyTiers: [{ refundPercent: 100, penaltyBps: 0 }, { refundPercent: 80, penaltyBps: 100 }, { refundPercent: 60, penaltyBps: 250 }, { refundPercent: 40, penaltyBps: 400 }, { refundPercent: 20, penaltyBps: 500 }, { refundPercent: 0, penaltyBps: 500 }],
};

type PolicyShape = typeof DEFAULT_POLICY;
type PolicyRecord = PolicyShape & { id: string; effectiveFrom: Date };

export async function activeWithdrawalPolicy(now = new Date()): Promise<PolicyRecord> {
  const existing = await db.withdrawalPolicy.findFirst({ where: { effectiveFrom: { lte: now } }, orderBy: { effectiveFrom: "desc" } });
  if (existing) return { ...existing, timeTiers: existing.timeTiers as PolicyShape["timeTiers"], progressTiers: existing.progressTiers as PolicyShape["progressTiers"], penaltyTiers: existing.penaltyTiers as PolicyShape["penaltyTiers"] };
  const created = await db.withdrawalPolicy.upsert({ where: { id: "efu-withdrawal-2026" }, update: {}, create: { id: "efu-withdrawal-2026", name: DEFAULT_POLICY.name, effectiveFrom: new Date("2026-07-17T00:00:00.000Z"), timeTiers: DEFAULT_POLICY.timeTiers, progressTiers: DEFAULT_POLICY.progressTiers, penaltyTiers: DEFAULT_POLICY.penaltyTiers } });
  return { ...created, timeTiers: DEFAULT_POLICY.timeTiers, progressTiers: DEFAULT_POLICY.progressTiers, penaltyTiers: DEFAULT_POLICY.penaltyTiers };
}

export function calculateWithdrawalQuote(input: { enrolledAt: Date; progress: number; allocatedCents: number; now?: Date; policy: PolicyRecord }) {
  const now = input.now || new Date();
  const elapsedHours = Math.max(0, (now.getTime() - input.enrolledAt.getTime()) / 3600000);
  const timeTier = input.policy.timeTiers.find((tier) => tier.throughHours == null || elapsedHours <= tier.throughHours)!;
  const progressTier = input.policy.progressTiers.find((tier) => input.progress <= tier.throughPercent)!;
  const penaltyFree = elapsedHours <= 24;
  const refundPercent = penaltyFree ? 100 : Math.min(timeTier.refundPercent, progressTier.refundPercent);
  const penaltyBps = input.policy.penaltyTiers.find((tier) => tier.refundPercent === refundPercent)?.penaltyBps ?? 500;
  return {
    refundPercent, refundCents: Math.round(input.allocatedCents * refundPercent / 100), allocatedCents: input.allocatedCents,
    penaltyBps, penaltyPercent: penaltyBps / 100, elapsedHours: Math.round(elapsedHours * 10) / 10, progress: input.progress,
    policyId: input.policy.id, policyName: input.policy.name, effectiveFrom: input.policy.effectiveFrom.toISOString(),
    explanation: penaltyFree ? "Withdrawal is within 24 hours: the full sponsored allocation returns with no renewal penalty." : `The lower of the elapsed-time tier (${timeTier.refundPercent}%) and progress tier (${progressTier.refundPercent}%) applies.`,
  };
}

export function calculateFundingStanding(input: { scores: number[]; withdrawalCount: number; withdrawalPenaltyBps: number; ownerOverrideMultiplierBps?: number | null }) {
  const finalizedGradeCount = input.scores.length;
  const gradeAverage = finalizedGradeCount ? input.scores.reduce((sum, score) => sum + score, 0) / finalizedGradeCount : 0;
  const withdrawalPenaltyBps = Math.min(MAX_WITHDRAWAL_PENALTY_BPS, input.withdrawalPenaltyBps);
  const gradePenaltyBps = finalizedGradeCount < 2 || gradeAverage >= CONTINUING_GRADE ? 0 : gradeAverage >= 60 ? 1000 : gradeAverage >= 50 ? 1500 : 2500;
  const calculatedMultiplier = Math.max(MIN_RENEWAL_MULTIPLIER_BPS, 10000 - withdrawalPenaltyBps - gradePenaltyBps);
  const renewalMultiplierBps = input.ownerOverrideMultiplierBps == null ? calculatedMultiplier : Math.max(MIN_RENEWAL_MULTIPLIER_BPS, Math.min(10000, input.ownerOverrideMultiplierBps));
  const academicHold = finalizedGradeCount >= 2 && gradeAverage < CONTINUING_GRADE && input.ownerOverrideMultiplierBps == null;
  const status = academicHold ? "REVIEW_REQUIRED" as const : withdrawalPenaltyBps || gradePenaltyBps ? "SUPPORT" as const : "GOOD" as const;
  return { finalizedGradeCount, gradeAverage, withdrawalPenaltyBps, gradePenaltyBps, renewalMultiplierBps, academicHold, status };
}

export async function getOrCreateFundingStanding(userId: string) { return db.studentFundingStanding.upsert({ where: { userId }, update: {}, create: { userId } }); }

export async function recalculateFundingStanding(userId: string) {
  const [current, withdrawals, decisions] = await Promise.all([
    getOrCreateFundingStanding(userId),
    db.courseEnrollment.findMany({ where: { userId, status: "WITHDRAWN" }, select: { withdrawalPenaltyBps: true } }),
    db.aiGradeDecision.findMany({ where: { status: "AUTO_FINALIZED", submission: { studentId: userId, appeals: { none: { status: { in: ["SUBMITTED", "IN_REVIEW"] } } } } }, select: { totalScore: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const calculated = calculateFundingStanding({ scores: decisions.map((item) => item.totalScore), withdrawalCount: withdrawals.length, withdrawalPenaltyBps: withdrawals.reduce((sum, item) => sum + item.withdrawalPenaltyBps, 0), ownerOverrideMultiplierBps: current.ownerOverrideMultiplierBps });
  return db.studentFundingStanding.update({ where: { userId }, data: { ...calculated, withdrawalCount: withdrawals.length, lastGradeAt: decisions[0]?.createdAt || null } });
}

async function withdrawalContext(userId: string, enrollmentId: string) {
  const enrollment = await db.courseEnrollment.findFirst({ where: { id: enrollmentId, userId }, include: { course: true } });
  if (!enrollment) throw new Error("Enrollment not found.");
  if (enrollment.status !== "ACTIVE" || enrollment.completedAt) throw new Error("Only an active, incomplete course can be withdrawn.");
  const finalSubmission = await db.courseSubmission.findFirst({ where: { courseId: enrollment.courseId, studentId: userId }, select: { id: true } });
  if (finalSubmission) throw new Error("Withdrawal is unavailable after final course work has been submitted.");
  const allocation = await db.grantLedger.findFirst({ where: { userId, courseId: enrollment.courseId, type: "COURSE_ALLOCATION" }, orderBy: { createdAt: "desc" } });
  const policy = await activeWithdrawalPolicy();
  return { enrollment, quote: calculateWithdrawalQuote({ enrolledAt: enrollment.enrolledAt, progress: enrollment.progress, allocatedCents: allocation ? Math.abs(allocation.amountCents) : enrollment.course.serviceValueCents, policy }) };
}

export async function quoteCourseWithdrawal(userId: string, enrollmentId: string) { return withdrawalContext(userId, enrollmentId); }

export async function withdrawFromCourse(userId: string, enrollmentId: string, reason: string) {
  const existing = await db.courseEnrollment.findFirst({ where: { id: enrollmentId, userId }, include: { course: true } });
  if (!existing) throw new Error("Enrollment not found.");
  if (existing.status === "WITHDRAWN") return { enrollment: existing, standing: await recalculateFundingStanding(userId), alreadyProcessed: true };
  const { enrollment, quote } = await withdrawalContext(userId, enrollmentId);
  const idempotencyKey = `withdrawal-refund:${enrollment.id}`;
  await db.$transaction(async (tx) => {
    const locked = await tx.courseEnrollment.updateMany({ where: { id: enrollment.id, status: "ACTIVE", withdrawnAt: null }, data: { status: "WITHDRAWN", withdrawnAt: new Date(), withdrawalReason: reason, refundCents: quote.refundCents, refundPercent: quote.refundPercent, withdrawalPenaltyBps: quote.penaltyBps, withdrawalPolicyId: quote.policyId, withdrawalPolicySnapshot: quote } });
    if (locked.count !== 1) return;
    const account = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { grantBalanceCents: true } });
    let fundingAwardId: string | undefined;
    if (quote.refundCents) { await tx.user.update({ where: { id: userId }, data: { grantBalanceCents: { increment: quote.refundCents } } }); const award = await tx.fundingAward.create({ data: { referenceNumber: fundingReference(), userId, type: "REFUND", sourceName: `${enrollment.course.code} withdrawal return`, originalAmountCents: quote.refundCents, remainingAmountCents: quote.refundCents, publicDescription: `${quote.refundPercent}% of the internal course allocation was returned under the effective withdrawal policy.`, restrictions: "Eligible Enfusion University learning services only; noncashable.", issuingDepartment: "University Sponsorship Office" } }); fundingAwardId = award.id; }
    await tx.grantLedger.create({ data: { userId, fundingAwardId, courseId: enrollment.courseId, type: "WITHDRAWAL_REFUND", amountCents: quote.refundCents, description: `${enrollment.course.code} withdrawal return (${quote.refundPercent}% of sponsored allocation)`, idempotencyKey, referenceNumber: fundingReference("EFT"), runningBalanceCents: account.grantBalanceCents + quote.refundCents, publicReason: "WITHDRAWAL_RETURN", metadata: { ...quote, nonCash: true } } });
    await tx.studentActivityEvent.create({ data: { studentId: userId, actorId: userId, type: "ENROLLMENT", title: `Withdrew from ${enrollment.course.code}`, detail: `${quote.refundPercent}% of internal sponsored value returned; no student debt was created.`, entity: "CourseEnrollment", entityId: enrollment.id } });
    await tx.notification.create({ data: { userId, type: "ACADEMIC", title: `${enrollment.course.code} withdrawal recorded`, body: `${quote.refundPercent}% of the sponsored allocation returned. Renewal impact: ${quote.penaltyPercent} percentage points.`, actionUrl: "/university?view=student-center", dedupeKey: `${idempotencyKey}:notice` } });
    await tx.auditLog.create({ data: { actorId: userId, action: "COURSE_WITHDRAWN", entity: "CourseEnrollment", entityId: enrollment.id, detail: { courseId: enrollment.courseId, reason, quote } } });
  });
  return { enrollment: await db.courseEnrollment.findUniqueOrThrow({ where: { id: enrollment.id }, include: { course: true } }), standing: await recalculateFundingStanding(userId), quote, alreadyProcessed: false };
}
