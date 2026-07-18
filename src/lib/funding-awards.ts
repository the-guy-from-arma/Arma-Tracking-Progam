import crypto from "node:crypto";
import { FundingCapability, FundingAwardStatus, FundingAwardType, Prisma, UserRole } from "@prisma/client";
import { db } from "@/lib/db";

export const FUNDING_CAPABILITIES = ["VIEW", "NOTE", "ISSUE", "EDIT_DETAILS", "ADJUST", "REVERSE_UNUSED", "SUSPEND"] as const;
export const FUNDING_REASONS = ["APPLICATION_AWARD", "PROGRAM_PLAN", "COURSE_CONTINUITY", "WITHDRAWAL_RETURN", "EXPIRATION", "DATA_CORRECTION", "OWNER_OVERRIDE", "OTHER"] as const;
export const fundingReference = (prefix = "EFA") => `${prefix}-${new Date().getUTCFullYear()}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

export async function hasFundingCapability(user: { id: string; role: UserRole | string }, capability: FundingCapability) {
  if (user.role === "OWNER") return true;
  if (user.role === "ADMIN" && (capability === "VIEW" || capability === "NOTE")) return true;
  return Boolean(await db.fundingPermission.findUnique({ where: { userId_capability: { userId: user.id, capability } } }));
}

export async function requireFundingCapability(user: { id: string; role: UserRole | string }, capability: FundingCapability) {
  if (!await hasFundingCapability(user, capability)) throw new Error(`Funding ${capability.toLowerCase().replaceAll("_", " ")} authority is required.`);
}

export async function ensureLegacyFundingSource(userId: string) {
  const [count, user] = await Promise.all([
    db.fundingAward.count({ where: { userId } }),
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { grantBalanceCents: true } }),
  ]);
  if (count || user.grantBalanceCents <= 0) return;
  await db.fundingAward.create({ data: {
    referenceNumber: `LEGACY-${userId}`,
    userId, type: "UNIVERSITY_CREDIT", status: "AVAILABLE", sourceName: "Legacy institutional sponsored-learning balance",
    originalAmountCents: user.grantBalanceCents, remainingAmountCents: user.grantBalanceCents,
    publicDescription: "Opening source record for sponsored-learning value established before source-level accounting was activated.",
    restrictions: "Usable only for eligible Enfusion University learning services; noncashable and nontransferable.",
    issuingDepartment: "University Sponsorship Office", legacy: true,
  } });
}

export async function fundingAccount(userId: string, includePrivate = false) {
  const [user, awards, ledger] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { grantBalanceCents: true } }),
    db.fundingAward.findMany({ where: { userId }, include: { transactions: { orderBy: { createdAt: "desc" } } }, orderBy: [{ status: "asc" }, { awardedAt: "desc" }] }),
    db.grantLedger.findMany({ where: { userId }, include: { fundingAward: { select: { referenceNumber: true, sourceName: true } }, course: { select: { code: true, title: true } } }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  const now = Date.now(); const soon = now + 30 * 86400000;
  const pendingCents = awards.filter((award) => award.status === "PENDING").reduce((sum, award) => sum + award.remainingAmountCents, 0);
  const expiringSoonCents = awards.filter((award) => award.expiresAt && +award.expiresAt <= soon && +award.expiresAt >= now && !["REVERSED", "EXPIRED"].includes(award.status)).reduce((sum, award) => sum + award.remainingAmountCents, 0);
  const usedCents = awards.reduce((sum, award) => sum + Math.max(0, award.originalAmountCents - award.remainingAmountCents), 0);
  const sourceAvailableCents = awards.filter((award) => ["AVAILABLE", "PARTIALLY_USED", "ADJUSTED"].includes(award.status)).reduce((sum, award) => sum + award.remainingAmountCents, 0);
  const visibleAwards = includePrivate ? awards : awards.map(({ internalNote: _internalNote, transactions, ...award }) => ({ ...award, transactions: transactions.map(({ internalNote: _transactionNote, ...transaction }) => transaction) }));
  const visibleLedger = includePrivate ? ledger : ledger.map(({ internalNote: _internalNote, ...entry }) => entry);
  return { balanceCents: user.grantBalanceCents, sourceAvailableCents, pendingCents, usedCents, expiringSoonCents, awards: visibleAwards, ledger: visibleLedger, reconciled: sourceAvailableCents === user.grantBalanceCents, varianceCents: user.grantBalanceCents - sourceAvailableCents };
}

type AwardInput = { userId: string; type: FundingAwardType; sourceName: string; amountCents: number; expiresAt?: Date | null; publicDescription: string; restrictions: string; issuingDepartment: string; reason: string; internalNote?: string | null; idempotencyKey: string };
export async function issueFundingAward(actor: { id: string; role: UserRole | string }, input: AwardInput) {
  await requireFundingCapability(actor, "ISSUE");
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error("Award value must be a positive whole-cent amount.");
  return db.$transaction(async (tx) => {
    const duplicate = await tx.grantLedger.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { fundingAward: true } }); if (duplicate?.fundingAward) return duplicate.fundingAward;
    const account = await tx.user.findUniqueOrThrow({ where: { id: input.userId }, select: { grantBalanceCents: true } }); const next = account.grantBalanceCents + input.amountCents;
    const award = await tx.fundingAward.create({ data: { referenceNumber: fundingReference(), userId: input.userId, type: input.type, sourceName: input.sourceName, originalAmountCents: input.amountCents, remainingAmountCents: input.amountCents, expiresAt: input.expiresAt, publicDescription: input.publicDescription, restrictions: input.restrictions, issuingDepartment: input.issuingDepartment, issuedById: actor.id, internalNote: input.internalNote } });
    const transaction = await tx.grantLedger.create({ data: { userId: input.userId, fundingAwardId: award.id, type: "SUPPLEMENTAL_AWARD", amountCents: input.amountCents, description: input.publicDescription, publicReason: input.reason, internalNote: input.internalNote, actorId: actor.id, idempotencyKey: input.idempotencyKey, referenceNumber: fundingReference("EFT"), runningBalanceCents: next, metadata: { nonCash: true, studentResponsibilityCents: 0 } } });
    await tx.user.update({ where: { id: input.userId }, data: { grantBalanceCents: next } });
    await tx.fundingAwardRevision.create({ data: { fundingAwardId: award.id, actorId: actor.id, action: "ISSUED", reason: input.reason, publicReason: input.publicDescription, internalNote: input.internalNote, previous: {}, updated: { originalAmountCents: input.amountCents, remainingAmountCents: input.amountCents } } });
    await tx.notification.create({ data: { userId: input.userId, type: "FUNDING", title: "Sponsored-learning award added", body: `${input.sourceName} added ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(input.amountCents / 100)} in internal learning-service value. Student responsibility remains $0.00.`, actionUrl: "/university?view=funding", dedupeKey: `funding-award:${award.id}` } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "FUNDING_AWARD_ISSUED", entity: "FundingAward", entityId: award.id, detail: { studentId: input.userId, transactionId: transaction.id, amountCents: input.amountCents, reason: input.reason } } });
    return award;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function mutateFundingAward(actor: { id: string; role: UserRole | string }, awardId: string, action: "ADJUST" | "SUSPEND" | "RESUME" | "REVERSE_UNUSED" | "NOTE", payload: { amountCents?: number; reason: string; publicReason: string; internalNote?: string | null; idempotencyKey: string }) {
  const capability: FundingCapability = action === "NOTE" ? "NOTE" : action === "SUSPEND" || action === "RESUME" ? "SUSPEND" : action === "REVERSE_UNUSED" ? "REVERSE_UNUSED" : "ADJUST";
  await requireFundingCapability(actor, capability);
  if (!payload.reason || payload.publicReason.length < 5) throw new Error("A reason and student-visible explanation are required.");
  return db.$transaction(async (tx) => {
    const award = await tx.fundingAward.findUniqueOrThrow({ where: { id: awardId }, include: { user: { select: { grantBalanceCents: true } } } });
    const previous = { status: award.status, originalAmountCents: award.originalAmountCents, remainingAmountCents: award.remainingAmountCents };
    let status: FundingAwardStatus = award.status; let delta = 0;
    if (action === "SUSPEND") status = "SUSPENDED"; else if (action === "RESUME") status = award.remainingAmountCents < award.originalAmountCents ? "PARTIALLY_USED" : "AVAILABLE";
    else if (action === "REVERSE_UNUSED") { delta = -award.remainingAmountCents; status = "REVERSED"; }
    else if (action === "ADJUST") { const target = Number(payload.amountCents); if (!Number.isInteger(target) || target < 0) throw new Error("Enter a valid new available value."); delta = target - award.remainingAmountCents; if (award.user.grantBalanceCents + delta < 0) throw new Error("The adjustment would create a negative account balance."); status = target === 0 ? "FULLY_USED" : target < award.originalAmountCents ? "ADJUSTED" : "AVAILABLE"; }
    const updated = action === "NOTE" ? award : await tx.fundingAward.update({ where: { id: award.id }, data: { status, remainingAmountCents: { increment: delta }, internalNote: payload.internalNote ?? award.internalNote } });
    if (delta) {
      const next = award.user.grantBalanceCents + delta; await tx.user.update({ where: { id: award.userId }, data: { grantBalanceCents: next } });
      await tx.grantLedger.create({ data: { userId: award.userId, fundingAwardId: award.id, type: delta < 0 ? "REVERSAL" : "ADJUSTMENT", amountCents: delta, description: payload.publicReason, publicReason: payload.reason, internalNote: payload.internalNote, actorId: actor.id, idempotencyKey: payload.idempotencyKey, referenceNumber: fundingReference("EFT"), runningBalanceCents: next, metadata: { action, nonCash: true } } });
    }
    await tx.fundingAwardRevision.create({ data: { fundingAwardId: award.id, actorId: actor.id, action, reason: payload.reason, publicReason: payload.publicReason, internalNote: payload.internalNote, previous, updated: { status: updated.status, originalAmountCents: updated.originalAmountCents, remainingAmountCents: updated.remainingAmountCents } } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: `FUNDING_AWARD_${action}`, entity: "FundingAward", entityId: award.id, detail: { reason: payload.reason, delta, previous, updated: { status: updated.status, remainingAmountCents: updated.remainingAmountCents } } } });
    if (action !== "NOTE") await tx.notification.create({ data: { userId: award.userId, type: "FUNDING", title: `Sponsored-learning source ${action.toLowerCase().replaceAll("_", " ")}`, body: `${payload.publicReason} Student responsibility remains $0.00.`, actionUrl: "/university?view=funding", dedupeKey: `funding-change:${payload.idempotencyKey}` } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
