CREATE TYPE "ApplicationTrackingType" AS ENUM ('ADMISSION', 'PROGRAM');
CREATE TYPE "ApplicationTrackingStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'CLOSED');

CREATE TABLE "ApplicationTracking" (
  "id" TEXT NOT NULL,
  "trackingNumber" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "ApplicationTrackingType" NOT NULL,
  "status" "ApplicationTrackingStatus" NOT NULL DEFAULT 'OPEN',
  "studentApplicationId" TEXT,
  "programApplicationId" TEXT,
  "outcome" TEXT,
  "statusHistory" JSONB NOT NULL DEFAULT '[]',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationTracking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApplicationTracking_trackingNumber_key" ON "ApplicationTracking"("trackingNumber");
CREATE INDEX "ApplicationTracking_userId_status_createdAt_idx" ON "ApplicationTracking"("userId", "status", "createdAt");
CREATE INDEX "ApplicationTracking_studentApplicationId_idx" ON "ApplicationTracking"("studentApplicationId");
CREATE INDEX "ApplicationTracking_programApplicationId_idx" ON "ApplicationTracking"("programApplicationId");
ALTER TABLE "ApplicationTracking" ADD CONSTRAINT "ApplicationTracking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationTracking" ADD CONSTRAINT "ApplicationTracking_studentApplicationId_fkey" FOREIGN KEY ("studentApplicationId") REFERENCES "StudentApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApplicationTracking" ADD CONSTRAINT "ApplicationTracking_programApplicationId_fkey" FOREIGN KEY ("programApplicationId") REFERENCES "ProgramApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "ApplicationTracking" ("id", "trackingNumber", "userId", "type", "status", "studentApplicationId", "outcome", "statusHistory", "submittedAt", "closedAt", "createdAt", "updatedAt")
SELECT
  'track-adm-' || substr(md5(sa."id"), 1, 20),
  'EFU-ADM-' || to_char(sa."submittedAt", 'YYYY') || '-' || upper(substr(md5(sa."id"), 1, 8)),
  sa."userId",
  'ADMISSION'::"ApplicationTrackingType",
  CASE WHEN sa."status"::text = 'SUBMITTED' THEN 'OPEN'::"ApplicationTrackingStatus" ELSE 'CLOSED'::"ApplicationTrackingStatus" END,
  sa."id",
  CASE WHEN sa."status"::text = 'SUBMITTED' THEN NULL ELSE sa."status"::text END,
  CASE WHEN sa."status"::text = 'SUBMITTED'
    THEN jsonb_build_array(jsonb_build_object('status', 'SUBMITTED', 'at', sa."submittedAt"))
    ELSE jsonb_build_array(jsonb_build_object('status', 'SUBMITTED', 'at', sa."submittedAt"), jsonb_build_object('status', sa."status"::text, 'at', COALESCE(sa."reviewedAt", sa."submittedAt")))
  END,
  sa."submittedAt",
  CASE WHEN sa."status"::text = 'SUBMITTED' THEN NULL ELSE COALESCE(sa."reviewedAt", sa."submittedAt") END,
  sa."submittedAt",
  COALESCE(sa."reviewedAt", sa."submittedAt")
FROM "StudentApplication" sa;

INSERT INTO "ApplicationTracking" ("id", "trackingNumber", "userId", "type", "status", "programApplicationId", "outcome", "statusHistory", "submittedAt", "closedAt", "createdAt", "updatedAt")
SELECT
  'track-prg-' || substr(md5(pa."id"), 1, 20),
  'EFU-PRG-' || to_char(pa."submittedAt", 'YYYY') || '-' || upper(substr(md5(pa."id"), 1, 8)),
  pa."userId",
  'PROGRAM'::"ApplicationTrackingType",
  CASE WHEN pa."status"::text = 'SUBMITTED' THEN 'OPEN'::"ApplicationTrackingStatus" ELSE 'CLOSED'::"ApplicationTrackingStatus" END,
  pa."id",
  CASE WHEN pa."status"::text = 'SUBMITTED' THEN NULL ELSE pa."status"::text END,
  CASE WHEN pa."status"::text = 'SUBMITTED'
    THEN jsonb_build_array(jsonb_build_object('status', 'SUBMITTED', 'at', pa."submittedAt"))
    ELSE jsonb_build_array(jsonb_build_object('status', 'SUBMITTED', 'at', pa."submittedAt"), jsonb_build_object('status', pa."status"::text, 'at', COALESCE(pa."decidedAt", pa."submittedAt")))
  END,
  pa."submittedAt",
  CASE WHEN pa."status"::text = 'SUBMITTED' THEN NULL ELSE COALESCE(pa."decidedAt", pa."submittedAt") END,
  pa."submittedAt",
  COALESCE(pa."decidedAt", pa."submittedAt")
FROM "ProgramApplication" pa;
