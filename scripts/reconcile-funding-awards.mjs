import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const apply = process.argv.includes("--apply") || process.env.FUNDING_BACKFILL_APPLY === "true";
const positiveTypes = new Set(["INITIAL_AWARD", "SUPPLEMENTAL_AWARD", "TERM_AWARD", "JUST_IN_TIME_AWARD", "RENEWAL_AWARD", "WITHDRAWAL_REFUND", "STANDING_RESTORATION"]);
const typeFor = (ledgerType) => ledgerType === "WITHDRAWAL_REFUND" ? "REFUND" : ledgerType === "JUST_IN_TIME_AWARD" ? "PROGRAM_FUNDING" : "INTERNAL_GRANT";
const reference = (prefix) => `${prefix}-${new Date().getUTCFullYear()}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

async function reconcileUser(user) {
  const ledger = await db.grantLedger.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  const existing = await db.fundingAward.count({ where: { userId: user.id } });
  if (existing) {
    const sources = await db.fundingAward.aggregate({ where: { userId: user.id, status: { in: ["AVAILABLE", "PARTIALLY_USED", "ADJUSTED"] } }, _sum: { remainingAmountCents: true } });
    return { userId: user.id, status: "existing", varianceCents: user.grantBalanceCents - (sources._sum.remainingAmountCents || 0), awards: existing };
  }
  const candidates = ledger.filter((entry) => entry.amountCents > 0 && positiveTypes.has(entry.type)).map((entry) => ({ entry, original: entry.amountCents, remaining: entry.amountCents }));
  for (const debit of ledger.filter((entry) => entry.amountCents < 0)) { let needed = Math.abs(debit.amountCents); for (const source of candidates) { const used = Math.min(source.remaining, needed); source.remaining -= used; needed -= used; if (!needed) break; } }
  const sourceTotal = candidates.reduce((sum, item) => sum + item.remaining, 0); const ambiguous = user.grantBalanceCents - sourceTotal;
  if (!apply) return { userId: user.id, status: "report", ledger: ledger.length, proposedAwards: candidates.length + (ambiguous > 0 ? 1 : 0), varianceCents: ambiguous };
  await db.$transaction(async (tx) => {
    for (const source of candidates) {
      const award = await tx.fundingAward.create({ data: { referenceNumber: `BACKFILL-${source.entry.id}`, userId: user.id, type: typeFor(source.entry.type), status: source.remaining <= 0 ? "FULLY_USED" : source.remaining < source.original ? "PARTIALLY_USED" : "AVAILABLE", sourceName: source.entry.description, originalAmountCents: source.original, remainingAmountCents: source.remaining, awardedAt: source.entry.createdAt, publicDescription: source.entry.description, restrictions: "Eligible Enfusion University learning services only; noncashable and nontransferable.", issuingDepartment: "University Sponsorship Office", legacy: true } });
      await tx.grantLedger.update({ where: { id: source.entry.id }, data: { fundingAwardId: award.id, referenceNumber: source.entry.referenceNumber || reference("EFT") } });
    }
    if (ambiguous > 0) await tx.fundingAward.create({ data: { referenceNumber: `LEGACY-${user.id}`, userId: user.id, type: "UNIVERSITY_CREDIT", status: "AVAILABLE", sourceName: "Legacy institutional source - provenance review", originalAmountCents: ambiguous, remainingAmountCents: ambiguous, publicDescription: "Opening source record for value established before source-level accounting.", restrictions: "Eligible university learning services only; noncashable and nontransferable.", issuingDepartment: "University Sponsorship Office", internalNote: "Ambiguous historical provenance retained without inventing a source.", legacy: true } });
    await tx.auditLog.create({ data: { action: "FUNDING_SOURCE_BACKFILL", entity: "User", entityId: user.id, detail: { ledgerEntries: ledger.length, awards: candidates.length, ambiguousCents: Math.max(0, ambiguous) } } });
  });
  const sources = await db.fundingAward.aggregate({ where: { userId: user.id, status: { in: ["AVAILABLE", "PARTIALLY_USED", "ADJUSTED"] } }, _sum: { remainingAmountCents: true } });
  return { userId: user.id, status: "applied", varianceCents: user.grantBalanceCents - (sources._sum.remainingAmountCents || 0) };
}

const users = await db.user.findMany({ where: { isStudent: true }, select: { id: true, studentNumber: true, grantBalanceCents: true } });
const results = []; for (const user of users) results.push({ studentNumber: user.studentNumber, ...await reconcileUser(user) });
const unexplained = results.filter((item) => item.varianceCents !== 0);
console.log(JSON.stringify({ mode: apply ? "apply" : "report-only", students: users.length, unexplained: unexplained.length, totalVarianceCents: unexplained.reduce((sum, item) => sum + item.varianceCents, 0), results }, null, 2));
await db.$disconnect(); if (apply && unexplained.length) process.exitCode = 2;
