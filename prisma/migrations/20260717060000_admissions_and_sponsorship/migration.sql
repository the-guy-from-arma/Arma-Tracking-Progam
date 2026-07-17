CREATE TYPE "AdmissionStatus" AS ENUM ('SUBMITTED', 'ADMITTED', 'WAITLISTED', 'DECLINED');
CREATE TYPE "GrantLedgerType" AS ENUM ('INITIAL_AWARD', 'SUPPLEMENTAL_AWARD', 'COURSE_ALLOCATION', 'ADJUSTMENT');

ALTER TABLE "User" ADD COLUMN "grantBalanceCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Course" ADD COLUMN "serviceValueCents" INTEGER NOT NULL DEFAULT 450000;

CREATE TABLE "StudentApplication" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "preferredName" TEXT,
  "country" TEXT NOT NULL,
  "timeZone" TEXT NOT NULL,
  "experienceLevel" TEXT NOT NULL,
  "workbenchExperience" TEXT NOT NULL,
  "enforceExperience" TEXT NOT NULL,
  "weeklyHours" INTEGER NOT NULL,
  "learningGoals" TEXT NOT NULL,
  "portfolioUrl" TEXT,
  "githubUrl" TEXT,
  "fundingStatement" TEXT NOT NULL,
  "supportNeeds" TEXT,
  "status" "AdmissionStatus" NOT NULL DEFAULT 'ADMITTED',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "StudentApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GrantLedger" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "GrantLedgerType" NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "courseId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GrantLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentApplication_userId_key" ON "StudentApplication"("userId");
CREATE INDEX "GrantLedger_userId_createdAt_idx" ON "GrantLedger"("userId", "createdAt");
ALTER TABLE "StudentApplication" ADD CONSTRAINT "StudentApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrantLedger" ADD CONSTRAINT "GrantLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "Course" SET "serviceValueCents" = 450000 WHERE "code" = 'TBS-101';
UPDATE "Course" SET "serviceValueCents" = 950000 WHERE "code" = 'BRS-210';
UPDATE "Course" SET "serviceValueCents" = 1600000 WHERE "code" = 'VAL-320';
