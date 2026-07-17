ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'FACULTY';
ALTER TYPE "SourceSyncStatus" ADD VALUE IF NOT EXISTS 'BYPASSED';
ALTER TYPE "SourceSyncStatus" ADD VALUE IF NOT EXISTS 'DISABLED';
CREATE TYPE "GuideAudience" AS ENUM ('FACULTY', 'ADMIN');

ALTER TABLE "CurriculumSource"
  ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN "lastSuccessAt" TIMESTAMP(3),
  ADD COLUMN "lastHttpStatus" INTEGER,
  ADD COLUMN "lastErrorCode" TEXT,
  ADD COLUMN "lastErrorMessage" TEXT,
  ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastGoodRevisionId" TEXT,
  ADD COLUMN "lastGoodExcerpt" TEXT,
  ADD COLUMN "bypassedAt" TIMESTAMP(3),
  ADD COLUMN "bypassReason" TEXT,
  ADD COLUMN "bypassRevisionId" TEXT,
  ADD COLUMN "bypassedById" TEXT,
  ADD COLUMN "disabledAt" TIMESTAMP(3);

UPDATE "CurriculumSource"
SET "lastAttemptAt" = "lastSyncedAt",
    "lastSuccessAt" = CASE WHEN "syncStatus" IN ('CURRENT','UPDATED') THEN "lastSyncedAt" ELSE NULL END,
    "lastGoodRevisionId" = CASE WHEN "syncStatus" IN ('CURRENT','UPDATED') THEN "revisionId" ELSE NULL END,
    "lastGoodExcerpt" = CASE WHEN "syncStatus" IN ('CURRENT','UPDATED') THEN "sourceExcerpt" ELSE NULL END;

CREATE TABLE "CourseSourceMapping" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseSourceMapping_pkey" PRIMARY KEY ("id")
);
INSERT INTO "CourseSourceMapping" ("id", "courseId", "sourceId")
SELECT 'csm_' || md5("courseId" || ':' || "id"), "courseId", "id"
FROM "CurriculumSource" WHERE "courseId" IS NOT NULL;
CREATE UNIQUE INDEX "CourseSourceMapping_courseId_sourceId_key" ON "CourseSourceMapping"("courseId", "sourceId");
CREATE INDEX "CourseSourceMapping_sourceId_idx" ON "CourseSourceMapping"("sourceId");
ALTER TABLE "CourseSourceMapping" ADD CONSTRAINT "CourseSourceMapping_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseSourceMapping" ADD CONSTRAINT "CourseSourceMapping_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CurriculumSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SourceSyncAttempt" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "actorId" TEXT,
  "mode" TEXT NOT NULL DEFAULT 'NORMAL',
  "outcome" TEXT NOT NULL,
  "httpStatus" INTEGER,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "revisionId" TEXT,
  "detail" JSONB NOT NULL DEFAULT '{}',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SourceSyncAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SourceSyncAttempt_sourceId_startedAt_idx" ON "SourceSyncAttempt"("sourceId", "startedAt");
ALTER TABLE "SourceSyncAttempt" ADD CONSTRAINT "SourceSyncAttempt_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CurriculumSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SourceSyncAttempt" ADD CONSTRAINT "SourceSyncAttempt_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CurriculumSource" ADD CONSTRAINT "CurriculumSource_bypassedById_fkey" FOREIGN KEY ("bypassedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX "CurriculumSource_courseId_syncStatus_idx";
ALTER TABLE "CurriculumSource" DROP CONSTRAINT "CurriculumSource_courseId_fkey";
ALTER TABLE "CurriculumSource" DROP COLUMN "courseId";
CREATE INDEX "CurriculumSource_syncStatus_lastAttemptAt_idx" ON "CurriculumSource"("syncStatus", "lastAttemptAt");

CREATE TABLE "WithdrawalPolicy" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "timeTiers" JSONB NOT NULL,
  "progressTiers" JSONB NOT NULL,
  "penaltyTiers" JSONB NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WithdrawalPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WithdrawalPolicy_effectiveFrom_key" ON "WithdrawalPolicy"("effectiveFrom");
CREATE INDEX "WithdrawalPolicy_effectiveFrom_idx" ON "WithdrawalPolicy"("effectiveFrom");
ALTER TABLE "WithdrawalPolicy" ADD CONSTRAINT "WithdrawalPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CourseEnrollment"
  ADD COLUMN "refundPercent" INTEGER,
  ADD COLUMN "withdrawalPenaltyBps" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "withdrawalPolicyId" TEXT,
  ADD COLUMN "withdrawalPolicySnapshot" JSONB;
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_withdrawalPolicyId_fkey" FOREIGN KEY ("withdrawalPolicyId") REFERENCES "WithdrawalPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
UPDATE "CourseEnrollment" SET "refundPercent" = 30, "withdrawalPenaltyBps" = 500
WHERE "status" = 'WITHDRAWN' AND "withdrawnAt" IS NOT NULL;

CREATE TABLE "Guide" (
  "id" TEXT NOT NULL, "slug" TEXT NOT NULL, "audience" "GuideAudience" NOT NULL,
  "title" TEXT NOT NULL, "summary" TEXT NOT NULL, "category" TEXT NOT NULL,
  "route" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "published" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Guide_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Guide_slug_key" ON "Guide"("slug");
CREATE INDEX "Guide_audience_published_sortOrder_idx" ON "Guide"("audience", "published", "sortOrder");
CREATE TABLE "GuideStep" (
  "id" TEXT NOT NULL, "guideId" TEXT NOT NULL, "stepNumber" INTEGER NOT NULL,
  "title" TEXT NOT NULL, "instruction" TEXT NOT NULL, "controlId" TEXT,
  CONSTRAINT "GuideStep_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuideStep_guideId_stepNumber_key" ON "GuideStep"("guideId", "stepNumber");
ALTER TABLE "GuideStep" ADD CONSTRAINT "GuideStep_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "Guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "GuideProgress" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "guideStepId" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuideProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuideProgress_userId_guideStepId_key" ON "GuideProgress"("userId", "guideStepId");
CREATE INDEX "GuideProgress_userId_completedAt_idx" ON "GuideProgress"("userId", "completedAt");
ALTER TABLE "GuideProgress" ADD CONSTRAINT "GuideProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuideProgress" ADD CONSTRAINT "GuideProgress_guideStepId_fkey" FOREIGN KEY ("guideStepId") REFERENCES "GuideStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
