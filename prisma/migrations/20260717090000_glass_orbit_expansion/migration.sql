ALTER TYPE "SubmissionStatus" ADD VALUE IF NOT EXISTS 'PENDING_AI_REVIEW';
ALTER TYPE "SubmissionStatus" ADD VALUE IF NOT EXISTS 'AI_REVIEWING';
ALTER TYPE "SubmissionStatus" ADD VALUE IF NOT EXISTS 'AI_EXCEPTION';
ALTER TYPE "SubmissionStatus" ADD VALUE IF NOT EXISTS 'APPEALED';

ALTER TYPE "ProgramLevel" ADD VALUE IF NOT EXISTS 'SHORT';
ALTER TYPE "ProgramLevel" ADD VALUE IF NOT EXISTS 'ASSOCIATE';
ALTER TYPE "ProgramLevel" ADD VALUE IF NOT EXISTS 'BACHELOR';

ALTER TYPE "GrantLedgerType" ADD VALUE IF NOT EXISTS 'TERM_AWARD';
ALTER TYPE "GrantLedgerType" ADD VALUE IF NOT EXISTS 'JUST_IN_TIME_AWARD';
ALTER TYPE "GrantLedgerType" ADD VALUE IF NOT EXISTS 'RENEWAL_AWARD';
ALTER TYPE "GrantLedgerType" ADD VALUE IF NOT EXISTS 'REVERSAL';
ALTER TYPE "GrantLedgerType" ADD VALUE IF NOT EXISTS 'EXPIRATION';
ALTER TYPE "GrantLedgerType" ADD VALUE IF NOT EXISTS 'CORRECTION';

CREATE TYPE "ProgramRequirementType" AS ENUM ('CORE', 'SUPPORTING', 'ELECTIVE', 'CAPSTONE');
CREATE TYPE "ProgramApplicationStatus" AS ENUM ('SUBMITTED', 'ADMITTED', 'WAITLISTED', 'DECLINED', 'WITHDRAWN');
CREATE TYPE "FundingTermStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'RENEWED', 'COMPLETED', 'PAUSED');
CREATE TYPE "NotificationType" AS ENUM ('FUNDING', 'ACADEMIC', 'FEEDBACK', 'DEADLINE', 'SYSTEM');
CREATE TYPE "AiGradeJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'EXCEPTION', 'FAILED');
CREATE TYPE "AiDecisionStatus" AS ENUM ('AUTO_FINALIZED', 'HUMAN_REVIEW_REQUIRED', 'OVERRIDDEN');
CREATE TYPE "AppealStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'UPHELD', 'OVERTURNED', 'CLOSED');

ALTER TABLE "AcademicProgram"
  ADD COLUMN "academy" TEXT NOT NULL DEFAULT 'Interdisciplinary Studies',
  ADD COLUMN "durationDays" INTEGER NOT NULL DEFAULT 120,
  ADD COLUMN "estimatedValueCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "credentialTitle" TEXT NOT NULL DEFAULT 'Program Completion Credential';

ALTER TABLE "ProgramEnrollment" ADD COLUMN "programApplicationId" TEXT;
CREATE UNIQUE INDEX "ProgramEnrollment_programApplicationId_key" ON "ProgramEnrollment"("programApplicationId");

ALTER TABLE "GrantLedger"
  ADD COLUMN "fundingTermId" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX "GrantLedger_idempotencyKey_key" ON "GrantLedger"("idempotencyKey");

ALTER TABLE "CourseSubmission" ADD COLUMN "resubmissionCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ProgramCourseRequirement" (
  "id" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "type" "ProgramRequirementType" NOT NULL DEFAULT 'CORE',
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "termNumber" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "ProgramCourseRequirement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProgramCourseRequirement_programId_courseId_key" ON "ProgramCourseRequirement"("programId", "courseId");
CREATE INDEX "ProgramCourseRequirement_programId_type_sequence_idx" ON "ProgramCourseRequirement"("programId", "type", "sequence");

CREATE TABLE "ProgramApplication" (
  "id" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "statement" TEXT NOT NULL,
  "weeklyHours" INTEGER NOT NULL,
  "experience" TEXT NOT NULL,
  "status" "ProgramApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
  "decisionNote" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "ProgramApplication_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProgramApplication_programId_userId_key" ON "ProgramApplication"("programId", "userId");
CREATE INDEX "ProgramApplication_status_submittedAt_idx" ON "ProgramApplication"("status", "submittedAt");

CREATE TABLE "StudentFundingTerm" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "programId" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "FundingTermStatus" NOT NULL DEFAULT 'ACTIVE',
  "scheduledValueCents" INTEGER NOT NULL,
  "reserveCents" INTEGER NOT NULL,
  "awardedCents" INTEGER NOT NULL,
  "renewedFromId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentFundingTerm_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentFundingTerm_userId_startsAt_key" ON "StudentFundingTerm"("userId", "startsAt");
CREATE INDEX "StudentFundingTerm_userId_status_endsAt_idx" ON "StudentFundingTerm"("userId", "status", "endsAt");

CREATE TABLE "TermPlanCourse" (
  "id" TEXT NOT NULL,
  "fundingTermId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "TermPlanCourse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TermPlanCourse_fundingTermId_courseId_key" ON "TermPlanCourse"("fundingTermId", "courseId");

CREATE TABLE "ValueRateSchedule" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "hourlyInstructionCents" INTEGER NOT NULL,
  "labServicesCents" INTEGER NOT NULL,
  "aiAssessmentCents" INTEGER NOT NULL,
  "studioServicesCents" INTEGER NOT NULL,
  "credentialAdminCents" INTEGER NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ValueRateSchedule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ValueRateSchedule_active_effectiveFrom_idx" ON "ValueRateSchedule"("active", "effectiveFrom");

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "actionUrl" TEXT,
  "readAt" TIMESTAMP(3),
  "dedupeKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

CREATE TABLE "GradingRubric" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "criteria" JSONB NOT NULL,
  "passingScore" INTEGER NOT NULL DEFAULT 70,
  "promptVersion" TEXT NOT NULL DEFAULT 'efu-grader-v1',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GradingRubric_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GradingRubric_courseId_key" ON "GradingRubric"("courseId");

CREATE TABLE "AiGradeJob" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "status" "AiGradeJobStatus" NOT NULL DEFAULT 'QUEUED',
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "idempotencyKey" TEXT NOT NULL,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiGradeJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiGradeJob_idempotencyKey_key" ON "AiGradeJob"("idempotencyKey");
CREATE INDEX "AiGradeJob_status_availableAt_idx" ON "AiGradeJob"("status", "availableAt");

CREATE TABLE "AiGradeDecision" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "rubricVersion" INTEGER NOT NULL,
  "wikiRevisionIds" JSONB NOT NULL DEFAULT '[]',
  "structuredResult" JSONB NOT NULL,
  "totalScore" INTEGER NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "passed" BOOLEAN NOT NULL,
  "status" "AiDecisionStatus" NOT NULL,
  "tokenUsage" JSONB NOT NULL DEFAULT '{}',
  "validationResult" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiGradeDecision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiGradeDecision_jobId_key" ON "AiGradeDecision"("jobId");
CREATE INDEX "AiGradeDecision_submissionId_createdAt_idx" ON "AiGradeDecision"("submissionId", "createdAt");

CREATE TABLE "SubmissionAppeal" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "AppealStatus" NOT NULL DEFAULT 'SUBMITTED',
  "reviewerId" TEXT,
  "resolution" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "SubmissionAppeal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SubmissionAppeal_status_submittedAt_idx" ON "SubmissionAppeal"("status", "submittedAt");
CREATE INDEX "SubmissionAppeal_studentId_idx" ON "SubmissionAppeal"("studentId");

ALTER TABLE "ProgramCourseRequirement" ADD CONSTRAINT "ProgramCourseRequirement_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AcademicProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramCourseRequirement" ADD CONSTRAINT "ProgramCourseRequirement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramApplication" ADD CONSTRAINT "ProgramApplication_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AcademicProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramApplication" ADD CONSTRAINT "ProgramApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_programApplicationId_fkey" FOREIGN KEY ("programApplicationId") REFERENCES "ProgramApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentFundingTerm" ADD CONSTRAINT "StudentFundingTerm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentFundingTerm" ADD CONSTRAINT "StudentFundingTerm_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AcademicProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentFundingTerm" ADD CONSTRAINT "StudentFundingTerm_renewedFromId_fkey" FOREIGN KEY ("renewedFromId") REFERENCES "StudentFundingTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GrantLedger" ADD CONSTRAINT "GrantLedger_fundingTermId_fkey" FOREIGN KEY ("fundingTermId") REFERENCES "StudentFundingTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TermPlanCourse" ADD CONSTRAINT "TermPlanCourse_fundingTermId_fkey" FOREIGN KEY ("fundingTermId") REFERENCES "StudentFundingTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TermPlanCourse" ADD CONSTRAINT "TermPlanCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradingRubric" ADD CONSTRAINT "GradingRubric_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiGradeJob" ADD CONSTRAINT "AiGradeJob_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "CourseSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiGradeDecision" ADD CONSTRAINT "AiGradeDecision_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AiGradeJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiGradeDecision" ADD CONSTRAINT "AiGradeDecision_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "CourseSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubmissionAppeal" ADD CONSTRAINT "SubmissionAppeal_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "CourseSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubmissionAppeal" ADD CONSTRAINT "SubmissionAppeal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubmissionAppeal" ADD CONSTRAINT "SubmissionAppeal_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
