ALTER TYPE "FacultyJobStatus" ADD VALUE IF NOT EXISTS 'WAITING_FOR_CONSENT';
ALTER TYPE "AiGradeJobStatus" ADD VALUE IF NOT EXISTS 'WAITING_FOR_CONSENT';

CREATE TYPE "PolicyVersionStatus" AS ENUM ('DRAFT','PUBLISHED','RETIRED');
CREATE TYPE "PolicyInquiryCategory" AS ENUM ('PRIVACY','ELECTRONIC_RECORDS','ACCOUNT_CLOSURE','BOHEMIA_IP','AI_DECISION','MONETARY_DISCLOSURE','ACCESSIBILITY','TERMS_DISPUTE','OTHER');
CREATE TYPE "PolicyInquiryStatus" AS ENUM ('OPEN','IN_REVIEW','AWAITING_REQUESTER','RESOLVED','CLOSED');
CREATE TYPE "PolicyMessageRole" AS ENUM ('REQUESTER','OWNER','SYSTEM');
CREATE TYPE "AiDataMode" AS ENUM ('UNCONFIRMED_OR_UNPAID','PAID_SERVICE_CONFIRMED','AI_DISABLED');

ALTER TABLE "User" ADD COLUMN "accountClosedAt" TIMESTAMP(3);
ALTER TABLE "Certificate" ADD COLUMN "publicVisible" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "PolicyDocument" (
  "id" TEXT NOT NULL, "slug" TEXT NOT NULL, "title" TEXT NOT NULL, "summary" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL, "mandatory" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PolicyDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PolicyDocument_slug_key" ON "PolicyDocument"("slug");
CREATE INDEX "PolicyDocument_sortOrder_idx" ON "PolicyDocument"("sortOrder");

CREATE TABLE "PolicyVersion" (
  "id" TEXT NOT NULL, "documentId" TEXT NOT NULL, "version" INTEGER NOT NULL, "content" JSONB NOT NULL,
  "checksum" TEXT NOT NULL, "revisionNote" TEXT NOT NULL, "status" "PolicyVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "materialChange" BOOLEAN NOT NULL DEFAULT true, "effectiveAt" TIMESTAMP(3), "publishedAt" TIMESTAMP(3),
  "legalReviewedAt" TIMESTAMP(3), "trademarkReviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PolicyVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PolicyVersion_documentId_version_key" ON "PolicyVersion"("documentId","version");
CREATE INDEX "PolicyVersion_status_effectiveAt_idx" ON "PolicyVersion"("status","effectiveAt");
ALTER TABLE "PolicyVersion" ADD CONSTRAINT "PolicyVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PolicyDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PolicySignatureEvent" (
  "id" TEXT NOT NULL, "receiptNumber" TEXT NOT NULL, "userId" TEXT, "applicantEmail" TEXT,
  "signerName" TEXT NOT NULL, "ageAttested" BOOLEAN NOT NULL, "electronicConsent" BOOLEAN NOT NULL,
  "userAgent" TEXT NOT NULL, "ipHash" TEXT NOT NULL, "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PolicySignatureEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PolicySignatureEvent_receiptNumber_key" ON "PolicySignatureEvent"("receiptNumber");
CREATE INDEX "PolicySignatureEvent_userId_signedAt_idx" ON "PolicySignatureEvent"("userId","signedAt");
ALTER TABLE "PolicySignatureEvent" ADD CONSTRAINT "PolicySignatureEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PolicyAcceptance" (
  "id" TEXT NOT NULL, "signatureEventId" TEXT NOT NULL, "policyVersionId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PolicyAcceptance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PolicyAcceptance_signatureEventId_policyVersionId_key" ON "PolicyAcceptance"("signatureEventId","policyVersionId");
CREATE UNIQUE INDEX "PolicyAcceptance_userId_policyVersionId_key" ON "PolicyAcceptance"("userId","policyVersionId");
CREATE INDEX "PolicyAcceptance_userId_acceptedAt_idx" ON "PolicyAcceptance"("userId","acceptedAt");
ALTER TABLE "PolicyAcceptance" ADD CONSTRAINT "PolicyAcceptance_signatureEventId_fkey" FOREIGN KEY ("signatureEventId") REFERENCES "PolicySignatureEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PolicyAcceptance" ADD CONSTRAINT "PolicyAcceptance_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PolicyAcceptance" ADD CONSTRAINT "PolicyAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PolicyInquiry" (
  "id" TEXT NOT NULL, "trackingNumber" TEXT NOT NULL, "tokenHash" TEXT, "userId" TEXT,
  "requesterName" TEXT NOT NULL, "requesterEmail" TEXT, "category" "PolicyInquiryCategory" NOT NULL,
  "subject" TEXT NOT NULL, "status" "PolicyInquiryStatus" NOT NULL DEFAULT 'OPEN',
  "disputeDeadline" TIMESTAMP(3), "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PolicyInquiry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PolicyInquiry_trackingNumber_key" ON "PolicyInquiry"("trackingNumber");
CREATE INDEX "PolicyInquiry_userId_createdAt_idx" ON "PolicyInquiry"("userId","createdAt");
CREATE INDEX "PolicyInquiry_status_category_createdAt_idx" ON "PolicyInquiry"("status","category","createdAt");
ALTER TABLE "PolicyInquiry" ADD CONSTRAINT "PolicyInquiry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PolicyInquiryMessage" (
  "id" TEXT NOT NULL, "inquiryId" TEXT NOT NULL, "role" "PolicyMessageRole" NOT NULL,
  "authorId" TEXT, "body" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PolicyInquiryMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PolicyInquiryMessage_inquiryId_createdAt_idx" ON "PolicyInquiryMessage"("inquiryId","createdAt");
ALTER TABLE "PolicyInquiryMessage" ADD CONSTRAINT "PolicyInquiryMessage_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "PolicyInquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PolicyInquiryMessage" ADD CONSTRAINT "PolicyInquiryMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "InstitutionPolicySetting" (
  "id" TEXT NOT NULL DEFAULT 'institution-policy', "gateActive" BOOLEAN NOT NULL DEFAULT false,
  "aiDataMode" "AiDataMode" NOT NULL DEFAULT 'UNCONFIRMED_OR_UNPAID', "legalReviewConfirmedAt" TIMESTAMP(3),
  "trademarkReviewConfirmedAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstitutionPolicySetting_pkey" PRIMARY KEY ("id")
);
