ALTER TABLE "ProgramEnrollment"
  ADD COLUMN "withdrawnAt" TIMESTAMP(3),
  ADD COLUMN "withdrawalReason" TEXT,
  ADD COLUMN "changeTargetProgramId" TEXT,
  ADD COLUMN "programChangePenaltyBps" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "programChangePolicySnapshot" JSONB;

CREATE INDEX "ProgramEnrollment_userId_withdrawnAt_idx"
  ON "ProgramEnrollment"("userId", "withdrawnAt");
