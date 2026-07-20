CREATE TYPE "LessonContentStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PUBLISHED', 'REJECTED', 'SUPERSEDED');
CREATE TYPE "CurriculumCompileStatus" AS ENUM ('QUEUED', 'PROCESSING', 'VALIDATED', 'PUBLISHED', 'EXCEPTION', 'FAILED', 'CANCELLED');

ALTER TABLE "CourseDay" ADD COLUMN "activeContentVersionId" TEXT;
ALTER TABLE "LessonProgress" ADD COLUMN "developmentNotes" TEXT;
ALTER TABLE "LessonProgress" ADD COLUMN "stepState" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "LessonProgress" ADD COLUMN "answerDraft" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "LessonProgress" ADD COLUMN "readingPosition" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LessonProgress" ADD COLUMN "acknowledgedVersionId" TEXT;
ALTER TABLE "LessonProgress" ADD COLUMN "materiallyChangedAt" TIMESTAMP(3);
ALTER TABLE "QuizAttempt" ADD COLUMN "response" JSONB;
ALTER TABLE "QuizAttempt" ADD COLUMN "questionId" TEXT;
ALTER TABLE "QuizAttempt" ADD COLUMN "questionType" TEXT;
ALTER TABLE "QuizAttempt" ADD COLUMN "criteriaVersion" TEXT;

CREATE TABLE "WikiSourceSnapshot" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "revisionTimestamp" TIMESTAMP(3),
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "categories" JSONB NOT NULL DEFAULT '[]',
  "warnings" JSONB NOT NULL DEFAULT '[]',
  "structuredContent" JSONB NOT NULL,
  "contentChecksum" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WikiSourceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WikiMediaAsset" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "caption" TEXT,
  "altText" TEXT NOT NULL,
  "sourceSection" TEXT,
  "filePageUrl" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "WikiMediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LessonContentVersion" (
  "id" TEXT NOT NULL,
  "courseDayId" TEXT NOT NULL,
  "compileJobId" TEXT,
  "version" INTEGER NOT NULL,
  "status" "LessonContentStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "objectives" JSONB NOT NULL,
  "structuredContent" JSONB NOT NULL,
  "quizDefinition" JSONB NOT NULL,
  "reflectionPrompt" TEXT NOT NULL,
  "estimatedMinutes" INTEGER NOT NULL DEFAULT 90,
  "contentChecksum" TEXT NOT NULL,
  "similarityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "materiallyChanged" BOOLEAN NOT NULL DEFAULT false,
  "modelId" TEXT,
  "promptVersion" TEXT NOT NULL,
  "validationResult" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "LessonContentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LessonSourceLink" (
  "id" TEXT NOT NULL,
  "lessonContentVersionId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "sectionAnchor" TEXT NOT NULL,
  "claimRefs" JSONB NOT NULL DEFAULT '[]',
  CONSTRAINT "LessonSourceLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CurriculumCompileJob" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "status" "CurriculumCompileStatus" NOT NULL DEFAULT 'QUEUED',
  "mode" TEXT NOT NULL DEFAULT 'NORMAL',
  "idempotencyKey" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "requestedById" TEXT,
  "modelId" TEXT,
  "promptVersion" TEXT,
  "confidence" DOUBLE PRECISION,
  "validationResult" JSONB NOT NULL DEFAULT '{}',
  "previewPayload" JSONB,
  "sourceRevisionIds" JSONB NOT NULL DEFAULT '[]',
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "CurriculumCompileJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseDay_activeContentVersionId_key" ON "CourseDay"("activeContentVersionId");
CREATE UNIQUE INDEX "WikiSourceSnapshot_sourceId_revisionId_key" ON "WikiSourceSnapshot"("sourceId", "revisionId");
CREATE INDEX "WikiSourceSnapshot_sourceId_capturedAt_idx" ON "WikiSourceSnapshot"("sourceId", "capturedAt");
CREATE UNIQUE INDEX "WikiMediaAsset_snapshotId_url_key" ON "WikiMediaAsset"("snapshotId", "url");
CREATE INDEX "WikiMediaAsset_snapshotId_displayOrder_idx" ON "WikiMediaAsset"("snapshotId", "displayOrder");
CREATE UNIQUE INDEX "LessonContentVersion_courseDayId_version_key" ON "LessonContentVersion"("courseDayId", "version");
CREATE INDEX "LessonContentVersion_courseDayId_status_idx" ON "LessonContentVersion"("courseDayId", "status");
CREATE INDEX "LessonContentVersion_compileJobId_idx" ON "LessonContentVersion"("compileJobId");
CREATE UNIQUE INDEX "LessonSourceLink_lessonContentVersionId_snapshotId_sectionAnchor_key" ON "LessonSourceLink"("lessonContentVersionId", "snapshotId", "sectionAnchor");
CREATE INDEX "LessonSourceLink_sourceId_snapshotId_idx" ON "LessonSourceLink"("sourceId", "snapshotId");
CREATE UNIQUE INDEX "CurriculumCompileJob_idempotencyKey_key" ON "CurriculumCompileJob"("idempotencyKey");
CREATE INDEX "CurriculumCompileJob_status_availableAt_idx" ON "CurriculumCompileJob"("status", "availableAt");
CREATE INDEX "CurriculumCompileJob_courseId_createdAt_idx" ON "CurriculumCompileJob"("courseId", "createdAt");

ALTER TABLE "WikiSourceSnapshot" ADD CONSTRAINT "WikiSourceSnapshot_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CurriculumSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WikiMediaAsset" ADD CONSTRAINT "WikiMediaAsset_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "WikiSourceSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonContentVersion" ADD CONSTRAINT "LessonContentVersion_courseDayId_fkey" FOREIGN KEY ("courseDayId") REFERENCES "CourseDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonContentVersion" ADD CONSTRAINT "LessonContentVersion_compileJobId_fkey" FOREIGN KEY ("compileJobId") REFERENCES "CurriculumCompileJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourseDay" ADD CONSTRAINT "CourseDay_activeContentVersionId_fkey" FOREIGN KEY ("activeContentVersionId") REFERENCES "LessonContentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LessonSourceLink" ADD CONSTRAINT "LessonSourceLink_lessonContentVersionId_fkey" FOREIGN KEY ("lessonContentVersionId") REFERENCES "LessonContentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonSourceLink" ADD CONSTRAINT "LessonSourceLink_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CurriculumSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonSourceLink" ADD CONSTRAINT "LessonSourceLink_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "WikiSourceSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumCompileJob" ADD CONSTRAINT "CurriculumCompileJob_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
