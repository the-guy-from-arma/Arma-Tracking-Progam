import { db } from "@/lib/db";

const DAY_MS = 86_400_000;

function termDays() {
  const value = Number(process.env.FUNDING_TERM_DAYS || 120);
  return Number.isInteger(value) && value >= 30 && value <= 365 ? value : 120;
}

function reservePercent() {
  const value = Number(process.env.FUNDING_RESERVE_PERCENT || 15);
  return Number.isFinite(value) && value >= 0 && value <= 50 ? value : 15;
}

export async function ensureFundingTerm(userId: string) {
  const existing = await db.studentFundingTerm.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { plannedCourses: { include: { course: true }, orderBy: { sequence: "asc" } }, program: true },
    orderBy: { startsAt: "desc" },
  });
  if (existing) return existing;

  const enrollment = await db.programEnrollment.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { program: { include: { requirements: { include: { course: true }, orderBy: { sequence: "asc" } } } } },
    orderBy: { enrolledAt: "desc" },
  });
  const fallbackCourses = enrollment ? [] : await db.course.findMany({ where: { status: "PUBLISHED" }, orderBy: { code: "asc" }, take: 4 });
  const planned = (enrollment?.program.requirements.map((item) => item.course) || fallbackCourses).slice(0, 6);
  const scheduledValueCents = planned.reduce((sum, course) => sum + course.serviceValueCents, 0);
  const reserveCents = Math.round(scheduledValueCents * (reservePercent() / 100));
  const awardedCents = scheduledValueCents + reserveCents;
  const startsAt = new Date();
  startsAt.setUTCHours(0, 0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + termDays() * DAY_MS);
  const key = `term:${userId}:${startsAt.toISOString().slice(0, 10)}`;

  return db.$transaction(async (tx) => {
    const current = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { grantBalanceCents: true } });
    const depositCents = Math.max(0, awardedCents - current.grantBalanceCents);
    const term = await tx.studentFundingTerm.create({
      data: {
        userId,
        programId: enrollment?.programId,
        startsAt,
        endsAt,
        scheduledValueCents,
        reserveCents,
        awardedCents,
        plannedCourses: { create: planned.map((course, index) => ({ courseId: course.id, sequence: index + 1 })) },
      },
      include: { plannedCourses: { include: { course: true }, orderBy: { sequence: "asc" } }, program: true },
    });
    if (depositCents > 0) {
      await tx.user.update({ where: { id: userId }, data: { grantBalanceCents: { increment: depositCents } } });
      await tx.grantLedger.create({
        data: { userId, fundingTermId: term.id, type: "TERM_AWARD", amountCents: depositCents, description: "Thunder Buddies Studios 120-day sponsored learning award", idempotencyKey: key, metadata: { scheduledValueCents, reserveCents, nonCash: true } },
      });
    }
    await tx.notification.create({
      data: { userId, type: "FUNDING", title: "Your sponsored learning term is active", body: `Your ${termDays()}-day learning term is funded. Student responsibility remains $0.00.`, actionUrl: "/university?view=funding", dedupeKey: `${key}:notice` },
    });
    return term;
  });
}

export async function ensureCourseFunding(userId: string, courseId: string, requiredCents: number) {
  const term = await ensureFundingTerm(userId);
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { grantBalanceCents: true } });
    if (user.grantBalanceCents >= requiredCents) return { awardedCents: 0, balanceCents: user.grantBalanceCents, fundingTermId: term.id };
    const awardedCents = requiredCents - user.grantBalanceCents;
    const idempotencyKey = `jit:${userId}:${courseId}`;
    const existing = await tx.grantLedger.findUnique({ where: { idempotencyKey } });
    if (!existing) {
      await tx.grantLedger.create({ data: { userId, fundingTermId: term.id, courseId, type: "JUST_IN_TIME_AWARD", amountCents: awardedCents, description: "Automatic enrollment continuity award", idempotencyKey, metadata: { nonCash: true } } });
      await tx.user.update({ where: { id: userId }, data: { grantBalanceCents: { increment: awardedCents } } });
      await tx.notification.upsert({
        where: { dedupeKey: `${idempotencyKey}:notice` },
        update: {},
        create: { userId, type: "FUNDING", title: "Additional course funding applied", body: "A just-in-time sponsored award covered your next course. Student responsibility is $0.00.", actionUrl: "/university?view=funding", dedupeKey: `${idempotencyKey}:notice` },
      });
    }
    return { awardedCents: existing ? 0 : awardedCents, balanceCents: user.grantBalanceCents + (existing ? 0 : awardedCents), fundingTermId: term.id };
  });
}

export async function createFundingReminders(userId: string) {
  const term = await ensureFundingTerm(userId);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { grantBalanceCents: true } });
  const now = Date.now();
  const daysLeft = Math.max(0, Math.ceil((term.endsAt.getTime() - now) / DAY_MS));
  for (const threshold of [30, 14, 7, 1]) {
    if (daysLeft <= threshold) {
      await db.notification.upsert({
        where: { dedupeKey: `renewal:${term.id}:${threshold}` },
        update: {},
        create: { userId, type: "FUNDING", title: `Funding renewal in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`, body: "Your activity and academic standing will be checked automatically. No payment is required.", actionUrl: "/university?view=funding", dedupeKey: `renewal:${term.id}:${threshold}` },
      });
    }
  }
  const percent = term.awardedCents ? Math.round((user.grantBalanceCents / term.awardedCents) * 100) : 100;
  for (const threshold of [50, 25, 10]) {
    if (percent <= threshold) {
      await db.notification.upsert({
        where: { dedupeKey: `balance:${term.id}:${threshold}` },
        update: {},
        create: { userId, type: "FUNDING", title: `Sponsored balance is below ${threshold}%`, body: "Your account remains protected by automatic continuing-study awards.", actionUrl: "/university?view=funding", dedupeKey: `balance:${term.id}:${threshold}` },
      });
    }
  }
  return term;
}

export async function renewEligibleFundingTerms() {
  const now = new Date();
  const activeUsers = await db.studentFundingTerm.findMany({ where: { status: "ACTIVE" }, select: { userId: true }, distinct: ["userId"] });
  for (const item of activeUsers) await createFundingReminders(item.userId);
  const expiring = await db.studentFundingTerm.findMany({ where: { status: "ACTIVE", endsAt: { lte: now } }, include: { user: true, plannedCourses: true } });
  let renewed = 0;
  for (const term of expiring) {
    if (term.user.suspended) {
      await db.studentFundingTerm.update({ where: { id: term.id }, data: { status: "PAUSED" } });
      continue;
    }
    const startsAt = new Date(term.endsAt);
    const endsAt = new Date(startsAt.getTime() + termDays() * DAY_MS);
    const key = `renewal:${term.userId}:${startsAt.toISOString().slice(0, 10)}`;
    await db.$transaction(async (tx) => {
      const next = await tx.studentFundingTerm.create({ data: { userId: term.userId, programId: term.programId, startsAt, endsAt, status: "ACTIVE", scheduledValueCents: term.scheduledValueCents, reserveCents: term.reserveCents, awardedCents: term.awardedCents, renewedFromId: term.id, plannedCourses: { create: term.plannedCourses.map((item) => ({ courseId: item.courseId, sequence: item.sequence })) } } });
      await tx.studentFundingTerm.update({ where: { id: term.id }, data: { status: "RENEWED" } });
      await tx.user.update({ where: { id: term.userId }, data: { grantBalanceCents: { increment: term.awardedCents } } });
      await tx.grantLedger.create({ data: { userId: term.userId, fundingTermId: next.id, type: "RENEWAL_AWARD", amountCents: term.awardedCents, description: "Automatic 120-day sponsored learning renewal", idempotencyKey: key, metadata: { nonCash: true } } });
      await tx.notification.create({ data: { userId: term.userId, type: "FUNDING", title: "Your sponsored learning funding renewed", body: "A new 120-day term award is now available. Student responsibility remains $0.00.", actionUrl: "/university?view=funding", dedupeKey: `${key}:notice` } });
    });
    renewed++;
  }
  return { checked: expiring.length, renewed };
}
