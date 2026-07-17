CREATE TYPE "CourseLevel" AS ENUM ('FOUNDATION', 'INTERMEDIATE', 'ADVANCED', 'CAPSTONE');
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'WITHDRAWN');
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'DECLINED');
CREATE TYPE "ProgramLevel" AS ENUM ('CERTIFICATE', 'DIPLOMA', 'DEGREE_PATH');

CREATE TABLE "Course" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "deliverable" TEXT NOT NULL,
  "studio" TEXT NOT NULL,
  "level" "CourseLevel" NOT NULL,
  "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
  "learningCredits" INTEGER NOT NULL DEFAULT 3,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseEnrollment" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseSubmission" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "repositoryUrl" TEXT NOT NULL,
  "demoUrl" TEXT,
  "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "reviewerId" TEXT,
  "feedback" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Certificate" (
  "id" TEXT NOT NULL,
  "credentialCode" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "issuer" TEXT NOT NULL,
  "learningCredits" INTEGER NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AcademicProgram" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "level" "ProgramLevel" NOT NULL,
  "creditsRequired" INTEGER NOT NULL,
  "sponsoredBy" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicProgram_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgramEnrollment" (
  "id" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "creditsEarned" INTEGER NOT NULL DEFAULT 0,
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ProgramEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");
CREATE INDEX "Course_status_level_idx" ON "Course"("status", "level");
CREATE INDEX "Course_studio_idx" ON "Course"("studio");
CREATE UNIQUE INDEX "CourseEnrollment_courseId_userId_key" ON "CourseEnrollment"("courseId", "userId");
CREATE INDEX "CourseEnrollment_userId_status_idx" ON "CourseEnrollment"("userId", "status");
CREATE UNIQUE INDEX "CourseSubmission_courseId_studentId_key" ON "CourseSubmission"("courseId", "studentId");
CREATE INDEX "CourseSubmission_status_submittedAt_idx" ON "CourseSubmission"("status", "submittedAt");
CREATE INDEX "CourseSubmission_studentId_idx" ON "CourseSubmission"("studentId");
CREATE UNIQUE INDEX "Certificate_credentialCode_key" ON "Certificate"("credentialCode");
CREATE UNIQUE INDEX "Certificate_submissionId_key" ON "Certificate"("submissionId");
CREATE INDEX "Certificate_userId_issuedAt_idx" ON "Certificate"("userId", "issuedAt");
CREATE UNIQUE INDEX "AcademicProgram_code_key" ON "AcademicProgram"("code");
CREATE UNIQUE INDEX "ProgramEnrollment_programId_userId_key" ON "ProgramEnrollment"("programId", "userId");
CREATE INDEX "ProgramEnrollment_userId_status_idx" ON "ProgramEnrollment"("userId", "status");

ALTER TABLE "Course" ADD CONSTRAINT "Course_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseSubmission" ADD CONSTRAINT "CourseSubmission_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseSubmission" ADD CONSTRAINT "CourseSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseSubmission" ADD CONSTRAINT "CourseSubmission_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "CourseSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AcademicProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Course" ("id", "code", "title", "summary", "deliverable", "studio", "level", "status", "learningCredits", "updatedAt") VALUES
('valoris-course-tbs-101', 'TBS-101', 'Workbench Foundations', 'Learn safe project structure, resource workflows, prefab composition, and repeatable testing in Arma Reforger Workbench.', 'Create and package a playable quality-of-life mod with installation notes and a test checklist.', 'Thunder Buddies Studios', 'FOUNDATION', 'PUBLISHED', 3, CURRENT_TIMESTAMP),
('valoris-course-brs-210', 'BRS-210', 'Replicated Gameplay Systems', 'Build dependable Enfusion gameplay features with components, events, authority boundaries, and multiplayer replication.', 'Submit a multiplayer-ready gameplay system with source repository, demonstration, and technical brief.', 'Black Ridge Studios', 'INTERMEDIATE', 'PUBLISHED', 4, CURRENT_TIMESTAMP),
('valoris-course-joint-320', 'VAL-320', 'Production Mod Capstone', 'Move an original mod from scoped proposal through peer review, testing, documentation, and release readiness.', 'Deliver an original portfolio mod and defend its architecture during studio review.', 'Thunder Buddies Studios + Black Ridge Studios', 'CAPSTONE', 'PUBLISHED', 6, CURRENT_TIMESTAMP);

INSERT INTO "AcademicProgram" ("id", "code", "title", "summary", "level", "creditsRequired", "sponsoredBy", "updatedAt") VALUES
('valoris-program-certificate', 'VAL-CERT', 'Arma Mod Development Certificate', 'A focused pathway proving foundational Workbench, scripting, testing, and delivery competencies.', 'CERTIFICATE', 12, 'Project VALORIS Academic Council', CURRENT_TIMESTAMP),
('valoris-program-diploma', 'VAL-DIP', 'Advanced Enfusion Development Diploma', 'An advanced studio pathway centered on systems design, multiplayer reliability, leadership, and portfolio quality.', 'DIPLOMA', 24, 'Project VALORIS Academic Council', CURRENT_TIMESTAMP),
('valoris-program-degree', 'VAL-BDS', 'Bachelor-style Development Studies', 'A non-accredited university-style progression combining technical depth, production practice, mentorship, and a capstone portfolio.', 'DEGREE_PATH', 60, 'Project VALORIS Academic Council', CURRENT_TIMESTAMP);
