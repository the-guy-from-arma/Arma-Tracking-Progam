ALTER TYPE "GrantLedgerType" ADD VALUE IF NOT EXISTS 'WITHDRAWAL_REFUND';
ALTER TYPE "GrantLedgerType" ADD VALUE IF NOT EXISTS 'FUNDING_REDUCTION';
ALTER TYPE "GrantLedgerType" ADD VALUE IF NOT EXISTS 'STANDING_RESTORATION';

CREATE TYPE "FundingStandingStatus" AS ENUM ('GOOD', 'SUPPORT', 'REVIEW_REQUIRED');

ALTER TABLE "CourseEnrollment"
  ADD COLUMN "withdrawnAt" TIMESTAMP(3),
  ADD COLUMN "withdrawalReason" TEXT,
  ADD COLUMN "refundCents" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "StudentFundingStanding" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "finalizedGradeCount" INTEGER NOT NULL DEFAULT 0,
  "gradeAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "withdrawalCount" INTEGER NOT NULL DEFAULT 0,
  "withdrawalPenaltyBps" INTEGER NOT NULL DEFAULT 0,
  "gradePenaltyBps" INTEGER NOT NULL DEFAULT 0,
  "renewalMultiplierBps" INTEGER NOT NULL DEFAULT 10000,
  "status" "FundingStandingStatus" NOT NULL DEFAULT 'GOOD',
  "academicHold" BOOLEAN NOT NULL DEFAULT false,
  "lastGradeAt" TIMESTAMP(3),
  "ownerOverrideMultiplierBps" INTEGER,
  "ownerOverrideReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentFundingStanding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentFundingStanding_userId_key" ON "StudentFundingStanding"("userId");
CREATE INDEX "StudentFundingStanding_status_academicHold_idx" ON "StudentFundingStanding"("status", "academicHold");
ALTER TABLE "StudentFundingStanding" ADD CONSTRAINT "StudentFundingStanding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
