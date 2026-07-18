ALTER TYPE "AdmissionStatus" ADD VALUE IF NOT EXISTS 'UNDER_AUTOMATED_REVIEW';
ALTER TYPE "AdmissionStatus" ADD VALUE IF NOT EXISTS 'CLARIFICATION_REQUIRED';
ALTER TYPE "AdmissionStatus" ADD VALUE IF NOT EXISTS 'AUTOMATION_EXCEPTION';

CREATE TYPE "AdmissionReviewStatus" AS ENUM ('QUEUED','PROCESSING','WAITING_FOR_CONSENT','COMPLETED','CLARIFICATION_REQUIRED','EXCEPTION');
CREATE TYPE "AdmissionDecisionOutcome" AS ENUM ('AUTO_ADMITTED','CLARIFICATION_REQUIRED','AUTOMATION_EXCEPTION');
CREATE TYPE "AdmissionsMode" AS ENUM ('OPEN','PAUSED');
CREATE TYPE "EnrollmentMode" AS ENUM ('OPEN','PAUSED');
CREATE TYPE "CampusLearningMode" AS ENUM ('ACTIVE','ACADEMIC_BREAK','MAINTENANCE','EMERGENCY_CLOSURE');
CREATE TYPE "CampusSeason" AS ENUM ('GENERAL','SPRING_RECESS','SUMMER_SESSION','WINTER_RECESS','SEMESTER_TRANSITION','MAINTENANCE','EMERGENCY');
CREATE TYPE "OperationalPeriodStatus" AS ENUM ('SCHEDULED','ACTIVE','COMPLETED','CANCELLED');

ALTER TABLE "Course" ADD COLUMN "catalogVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CourseEnrollment" ADD COLUMN "expectedEndAt" TIMESTAMP(3), ADD COLUMN "pausedDays" INTEGER NOT NULL DEFAULT 0;
UPDATE "CourseEnrollment" AS enrollment
SET "expectedEndAt" = enrollment."enrolledAt" + (course."estimatedDays"::text || ' days')::interval
FROM "Course" AS course
WHERE enrollment."courseId" = course."id" AND enrollment."status" = 'ACTIVE' AND enrollment."expectedEndAt" IS NULL;

CREATE TABLE "AdmissionReviewJob" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "status" "AdmissionReviewStatus" NOT NULL DEFAULT 'QUEUED',
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "clarificationRound" INTEGER NOT NULL DEFAULT 0,
  "stage" TEXT NOT NULL DEFAULT 'APPLICATION_RECEIVED',
  "idempotencyKey" TEXT NOT NULL,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "heartbeatAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdmissionReviewJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdmissionReviewJob_idempotencyKey_key" ON "AdmissionReviewJob"("idempotencyKey");
CREATE INDEX "AdmissionReviewJob_status_availableAt_idx" ON "AdmissionReviewJob"("status","availableAt");
CREATE INDEX "AdmissionReviewJob_applicationId_createdAt_idx" ON "AdmissionReviewJob"("applicationId","createdAt");
ALTER TABLE "AdmissionReviewJob" ADD CONSTRAINT "AdmissionReviewJob_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "StudentApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AdmissionReviewDecision" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "outcome" "AdmissionDecisionOutcome" NOT NULL,
  "score" INTEGER NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "modelId" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "strengths" JSONB NOT NULL DEFAULT '[]',
  "concerns" JSONB NOT NULL DEFAULT '[]',
  "integrityFlags" JSONB NOT NULL DEFAULT '[]',
  "questions" JSONB NOT NULL DEFAULT '[]',
  "structuredResult" JSONB NOT NULL,
  "validationResult" JSONB NOT NULL DEFAULT '{}',
  "ownerOverrideById" TEXT,
  "ownerOverrideNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdmissionReviewDecision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdmissionReviewDecision_jobId_key" ON "AdmissionReviewDecision"("jobId");
CREATE INDEX "AdmissionReviewDecision_outcome_createdAt_idx" ON "AdmissionReviewDecision"("outcome","createdAt");
ALTER TABLE "AdmissionReviewDecision" ADD CONSTRAINT "AdmissionReviewDecision_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AdmissionReviewJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdmissionReviewDecision" ADD CONSTRAINT "AdmissionReviewDecision_ownerOverrideById_fkey" FOREIGN KEY ("ownerOverrideById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AdmissionClarification" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "applicantId" TEXT NOT NULL,
  "round" INTEGER NOT NULL,
  "questions" JSONB NOT NULL,
  "response" JSONB,
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdmissionClarification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdmissionClarification_applicationId_round_key" ON "AdmissionClarification"("applicationId","round");
CREATE INDEX "AdmissionClarification_applicantId_createdAt_idx" ON "AdmissionClarification"("applicantId","createdAt");
ALTER TABLE "AdmissionClarification" ADD CONSTRAINT "AdmissionClarification_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "StudentApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdmissionClarification" ADD CONSTRAINT "AdmissionClarification_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "InstitutionOperationalSetting" (
  "id" TEXT NOT NULL DEFAULT 'institution-operations',
  "admissionsMode" "AdmissionsMode" NOT NULL DEFAULT 'OPEN',
  "enrollmentMode" "EnrollmentMode" NOT NULL DEFAULT 'OPEN',
  "learningMode" "CampusLearningMode" NOT NULL DEFAULT 'ACTIVE',
  "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
  "publicTitle" TEXT NOT NULL DEFAULT 'Campus is open',
  "publicMessage" TEXT NOT NULL DEFAULT 'Admissions, enrollment, and learning services are available.',
  "reopensAt" TIMESTAMP(3),
  "season" "CampusSeason" NOT NULL DEFAULT 'GENERAL',
  "activePeriodId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstitutionOperationalSetting_pkey" PRIMARY KEY ("id")
);
INSERT INTO "InstitutionOperationalSetting" ("id","updatedAt") VALUES ('institution-operations', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;

CREATE TABLE "InstitutionOperationalPeriod" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "publicMessage" TEXT NOT NULL,
  "ownerNote" TEXT,
  "admissionsMode" "AdmissionsMode" NOT NULL,
  "enrollmentMode" "EnrollmentMode" NOT NULL,
  "learningMode" "CampusLearningMode" NOT NULL,
  "season" "CampusSeason" NOT NULL DEFAULT 'GENERAL',
  "status" "OperationalPeriodStatus" NOT NULL DEFAULT 'SCHEDULED',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "activatedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "deadlineExtensionAppliedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstitutionOperationalPeriod_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InstitutionOperationalPeriod_status_startsAt_endsAt_idx" ON "InstitutionOperationalPeriod"("status","startsAt","endsAt");
ALTER TABLE "InstitutionOperationalPeriod" ADD CONSTRAINT "InstitutionOperationalPeriod_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "OperationalDeadlineAdjustment" (
  "id" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "previousAt" TIMESTAMP(3) NOT NULL,
  "adjustedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalDeadlineAdjustment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OperationalDeadlineAdjustment_periodId_entityType_entityId_key" ON "OperationalDeadlineAdjustment"("periodId","entityType","entityId");
CREATE INDEX "OperationalDeadlineAdjustment_entityType_entityId_idx" ON "OperationalDeadlineAdjustment"("entityType","entityId");
ALTER TABLE "OperationalDeadlineAdjustment" ADD CONSTRAINT "OperationalDeadlineAdjustment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "InstitutionOperationalPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
