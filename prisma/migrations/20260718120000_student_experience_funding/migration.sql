CREATE TYPE "VeteranStatus" AS ENUM ('NOT_DISCLOSED','NOT_A_VETERAN','VETERAN','ACTIVE_DUTY','RESERVE_OR_GUARD','MILITARY_FAMILY');
CREATE TYPE "ResidencyStatus" AS ENUM ('NOT_DISCLOSED','DOMESTIC','INTERNATIONAL','OTHER');
CREATE TYPE "StudentActivityType" AS ENUM ('ENROLLMENT','GRADE','ADVISING','CREDENTIAL','APPLICATION','FUNDING','PROFILE');
CREATE TYPE "FundingAwardType" AS ENUM ('INTERNAL_SCHOLARSHIP','INTERNAL_GRANT','UNIVERSITY_CREDIT','PROGRAM_FUNDING','EMPLOYER_SPONSORSHIP','PROMOTIONAL_AWARD','REFUND','ADMINISTRATIVE_ADJUSTMENT','TRANSFER_VALUE','OTHER');
CREATE TYPE "FundingAwardStatus" AS ENUM ('PENDING','AVAILABLE','PARTIALLY_USED','FULLY_USED','EXPIRED','SUSPENDED','REVERSED','REMOVED','ADJUSTED');
CREATE TYPE "FundingTransactionStatus" AS ENUM ('PENDING','POSTED','REVERSED','ADJUSTED');
CREATE TYPE "FundingCapability" AS ENUM ('VIEW','NOTE','ISSUE','EDIT_DETAILS','ADJUST','REVERSE_UNUSED','SUSPEND');

ALTER TABLE "FacultyMessage" ADD COLUMN "clientMessageId" TEXT;
CREATE UNIQUE INDEX "FacultyMessage_clientMessageId_key" ON "FacultyMessage"("clientMessageId");
ALTER TABLE "FacultyReplyJob" ADD COLUMN "heartbeatAt" TIMESTAMP(3), ADD COLUMN "acknowledgedAt" TIMESTAMP(3), ADD COLUMN "supportRequestedAt" TIMESTAMP(3);

ALTER TABLE "GrantLedger"
  ADD COLUMN "fundingAwardId" TEXT,
  ADD COLUMN "status" "FundingTransactionStatus" NOT NULL DEFAULT 'POSTED',
  ADD COLUMN "runningBalanceCents" INTEGER,
  ADD COLUMN "publicReason" TEXT,
  ADD COLUMN "internalNote" TEXT,
  ADD COLUMN "actorId" TEXT,
  ADD COLUMN "reversalOfId" TEXT,
  ADD COLUMN "referenceNumber" TEXT;
CREATE UNIQUE INDEX "GrantLedger_referenceNumber_key" ON "GrantLedger"("referenceNumber");
CREATE INDEX "GrantLedger_fundingAwardId_createdAt_idx" ON "GrantLedger"("fundingAwardId","createdAt");
ALTER TABLE "GrantLedger" ADD CONSTRAINT "GrantLedger_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GrantLedger" ADD CONSTRAINT "GrantLedger_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GrantLedger" ADD CONSTRAINT "GrantLedger_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "GrantLedger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "StudentProfileDetail" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "addressLine1" TEXT, "addressLine2" TEXT,
  "city" TEXT, "region" TEXT, "postalCode" TEXT, "country" TEXT, "phone" TEXT,
  "emergencyName" TEXT, "emergencyRelationship" TEXT, "emergencyPhone" TEXT,
  "veteranStatus" "VeteranStatus" NOT NULL DEFAULT 'NOT_DISCLOSED',
  "residencyStatus" "ResidencyStatus" NOT NULL DEFAULT 'NOT_DISCLOSED',
  "preferredPronouns" TEXT, "minorAcademy" TEXT, "profilePhoto" BYTEA, "profilePhotoMime" TEXT,
  "profilePhotoUpdatedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "StudentProfileDetail_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentProfileDetail_userId_key" ON "StudentProfileDetail"("userId");
ALTER TABLE "StudentProfileDetail" ADD CONSTRAINT "StudentProfileDetail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StudentActivityEvent" (
  "id" TEXT NOT NULL, "studentId" TEXT NOT NULL, "type" "StudentActivityType" NOT NULL,
  "title" TEXT NOT NULL, "detail" TEXT NOT NULL, "entity" TEXT, "entityId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "actorId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentActivityEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StudentActivityEvent_studentId_occurredAt_idx" ON "StudentActivityEvent"("studentId","occurredAt");
CREATE INDEX "StudentActivityEvent_entity_entityId_idx" ON "StudentActivityEvent"("entity","entityId");
ALTER TABLE "StudentActivityEvent" ADD CONSTRAINT "StudentActivityEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentActivityEvent" ADD CONSTRAINT "StudentActivityEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FundingAward" (
  "id" TEXT NOT NULL, "referenceNumber" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "type" "FundingAwardType" NOT NULL, "status" "FundingAwardStatus" NOT NULL DEFAULT 'AVAILABLE',
  "sourceName" TEXT NOT NULL, "originalAmountCents" INTEGER NOT NULL, "remainingAmountCents" INTEGER NOT NULL,
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3),
  "publicDescription" TEXT NOT NULL, "restrictions" TEXT NOT NULL, "issuingDepartment" TEXT NOT NULL,
  "issuedById" TEXT, "internalNote" TEXT, "legacy" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FundingAward_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FundingAward_referenceNumber_key" ON "FundingAward"("referenceNumber");
CREATE INDEX "FundingAward_userId_status_awardedAt_idx" ON "FundingAward"("userId","status","awardedAt");
CREATE INDEX "FundingAward_expiresAt_idx" ON "FundingAward"("expiresAt");
ALTER TABLE "FundingAward" ADD CONSTRAINT "FundingAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FundingAward" ADD CONSTRAINT "FundingAward_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GrantLedger" ADD CONSTRAINT "GrantLedger_fundingAwardId_fkey" FOREIGN KEY ("fundingAwardId") REFERENCES "FundingAward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FundingAwardRevision" (
  "id" TEXT NOT NULL, "fundingAwardId" TEXT NOT NULL, "actorId" TEXT, "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL, "publicReason" TEXT NOT NULL, "internalNote" TEXT,
  "previous" JSONB NOT NULL, "updated" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FundingAwardRevision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FundingAwardRevision_fundingAwardId_createdAt_idx" ON "FundingAwardRevision"("fundingAwardId","createdAt");
ALTER TABLE "FundingAwardRevision" ADD CONSTRAINT "FundingAwardRevision_fundingAwardId_fkey" FOREIGN KEY ("fundingAwardId") REFERENCES "FundingAward"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FundingAwardRevision" ADD CONSTRAINT "FundingAwardRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FundingPermission" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "capability" "FundingCapability" NOT NULL,
  "grantedById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FundingPermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FundingPermission_userId_capability_key" ON "FundingPermission"("userId","capability");
CREATE INDEX "FundingPermission_capability_idx" ON "FundingPermission"("capability");
ALTER TABLE "FundingPermission" ADD CONSTRAINT "FundingPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FundingPermission" ADD CONSTRAINT "FundingPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
