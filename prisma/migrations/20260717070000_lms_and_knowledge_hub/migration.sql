CREATE TYPE "ObjectiveStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED');
CREATE TYPE "ObjectivePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
CREATE TYPE "ProjectUpdateType" AS ENUM ('PROGRESS', 'MILESTONE', 'DECISION', 'BLOCKER');
CREATE TYPE "SourceSyncStatus" AS ENUM ('CURRENT', 'UPDATED', 'WARNING', 'FAILED');

ALTER TABLE "Course" ADD COLUMN "academy" TEXT NOT NULL DEFAULT 'Workbench Foundations';
ALTER TABLE "Course" ADD COLUMN "estimatedDays" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Course" ADD COLUMN "workloadHours" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "Course" ADD COLUMN "outcomes" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Course" ADD COLUMN "wikiManaged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CourseSubmission" RENAME COLUMN "repositoryUrl" TO "referenceUrl";
ALTER TABLE "CourseSubmission" ALTER COLUMN "referenceUrl" DROP NOT NULL;

CREATE TABLE "CoursePrerequisite" (
  "id" TEXT NOT NULL, "courseId" TEXT NOT NULL, "prerequisiteId" TEXT NOT NULL,
  CONSTRAINT "CoursePrerequisite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CoursePrerequisite_courseId_prerequisiteId_key" ON "CoursePrerequisite"("courseId", "prerequisiteId");

CREATE TABLE "CourseDay" (
  "id" TEXT NOT NULL, "courseId" TEXT NOT NULL, "dayNumber" INTEGER NOT NULL, "title" TEXT NOT NULL,
  "objectives" JSONB NOT NULL DEFAULT '[]', "instructionalText" TEXT NOT NULL, "sourceSection" TEXT NOT NULL,
  "workbenchSteps" JSONB NOT NULL DEFAULT '[]', "practicalLab" TEXT NOT NULL, "completionChecklist" JSONB NOT NULL DEFAULT '[]',
  "knowledgeQuestion" TEXT NOT NULL, "knowledgeAnswer" TEXT NOT NULL, "reflectionPrompt" TEXT NOT NULL,
  CONSTRAINT "CourseDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CourseDay_courseId_dayNumber_key" ON "CourseDay"("courseId", "dayNumber");
CREATE INDEX "CourseDay_courseId_dayNumber_idx" ON "CourseDay"("courseId", "dayNumber");

CREATE TABLE "LessonProgress" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "courseDayId" TEXT NOT NULL, "completed" BOOLEAN NOT NULL DEFAULT false,
  "reflection" TEXT, "completedAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LessonProgress_userId_courseDayId_key" ON "LessonProgress"("userId", "courseDayId");
CREATE INDEX "LessonProgress_userId_completed_idx" ON "LessonProgress"("userId", "completed");

CREATE TABLE "QuizAttempt" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "courseDayId" TEXT NOT NULL, "answer" TEXT NOT NULL,
  "correct" BOOLEAN NOT NULL, "score" INTEGER NOT NULL, "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "QuizAttempt_userId_courseDayId_idx" ON "QuizAttempt"("userId", "courseDayId");

CREATE TABLE "CurriculumSource" (
  "id" TEXT NOT NULL, "wikiTitle" TEXT NOT NULL, "url" TEXT NOT NULL, "revisionId" TEXT, "revisionTimestamp" TIMESTAMP(3),
  "categories" JSONB NOT NULL DEFAULT '[]', "statusWarnings" JSONB NOT NULL DEFAULT '[]', "sourceExcerpt" TEXT NOT NULL,
  "courseId" TEXT, "syncStatus" "SourceSyncStatus" NOT NULL DEFAULT 'CURRENT', "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CurriculumSource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CurriculumSource_wikiTitle_key" ON "CurriculumSource"("wikiTitle");
CREATE INDEX "CurriculumSource_courseId_syncStatus_idx" ON "CurriculumSource"("courseId", "syncStatus");

CREATE TABLE "ProjectUpdate" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "authorId" TEXT NOT NULL, "type" "ProjectUpdateType" NOT NULL DEFAULT 'PROGRESS',
  "title" TEXT NOT NULL, "body" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectUpdate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectUpdate_projectId_createdAt_idx" ON "ProjectUpdate"("projectId", "createdAt");

CREATE TABLE "ProjectNote" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "authorId" TEXT NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL,
  "tags" JSONB NOT NULL DEFAULT '[]', "pinned" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ProjectNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectNote_projectId_pinned_updatedAt_idx" ON "ProjectNote"("projectId", "pinned", "updatedAt");

CREATE TABLE "ProjectObjective" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "title" TEXT NOT NULL, "details" TEXT NOT NULL,
  "status" "ObjectiveStatus" NOT NULL DEFAULT 'PLANNED', "priority" "ObjectivePriority" NOT NULL DEFAULT 'NORMAL',
  "assigneeId" TEXT, "dueDate" TIMESTAMP(3), "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectObjective_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectObjective_projectId_status_sortOrder_idx" ON "ProjectObjective"("projectId", "status", "sortOrder");

CREATE TABLE "ProjectReference" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "label" TEXT NOT NULL, "url" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'REFERENCE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectReference_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectReference_projectId_createdAt_idx" ON "ProjectReference"("projectId", "createdAt");

INSERT INTO "ProjectReference" ("id", "projectId", "label", "url", "type")
SELECT 'legacy-ref-' || "id", "id", 'Legacy project reference', "repository", 'REFERENCE' FROM "Project" WHERE "repository" IS NOT NULL AND "repository" <> '';
ALTER TABLE "Project" DROP COLUMN "repository";

CREATE TABLE "ProjectComment" (
  "id" TEXT NOT NULL, "updateId" TEXT NOT NULL, "authorId" TEXT NOT NULL, "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectComment_updateId_createdAt_idx" ON "ProjectComment"("updateId", "createdAt");

ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseDay" ADD CONSTRAINT "CourseDay_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_courseDayId_fkey" FOREIGN KEY ("courseDayId") REFERENCES "CourseDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_courseDayId_fkey" FOREIGN KEY ("courseDayId") REFERENCES "CourseDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CurriculumSource" ADD CONSTRAINT "CurriculumSource_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectUpdate" ADD CONSTRAINT "ProjectUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectUpdate" ADD CONSTRAINT "ProjectUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectNote" ADD CONSTRAINT "ProjectNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectNote" ADD CONSTRAINT "ProjectNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectObjective" ADD CONSTRAINT "ProjectObjective_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectObjective" ADD CONSTRAINT "ProjectObjective_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectReference" ADD CONSTRAINT "ProjectReference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectComment" ADD CONSTRAINT "ProjectComment_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "ProjectUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectComment" ADD CONSTRAINT "ProjectComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
