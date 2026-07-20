ALTER TYPE "AdmissionStatus" ADD VALUE IF NOT EXISTS 'GUARDIAN_CONSENT_REQUIRED';
ALTER TYPE "AdmissionReviewStatus" ADD VALUE IF NOT EXISTS 'WAITING_FOR_GUARDIAN';

CREATE TYPE "GuardianConsentStatus" AS ENUM ('INVITED','CONSENTED','IDENTITY_PENDING','PROCESSING','VERIFIED','REQUIRES_INPUT','ALTERNATIVE_REVIEW','REVOKED','EXPIRED');
CREATE TYPE "GuardianRelationship" AS ENUM ('PARENT','LEGAL_GUARDIAN','OTHER_GUARDIAN');
CREATE TYPE "GuardianVerificationMethod" AS ENUM ('STRIPE_IDENTITY','ALTERNATIVE_REVIEW');
CREATE TYPE "StudentAccountStatus" AS ENUM ('ACTIVE','CURRICULUM_PAUSED','NOT_GOOD_STANDING','SUSPENDED','EXPELLED');

ALTER TABLE "User"
ADD COLUMN "studentAccountStatus" "StudentAccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "studentStatusReason" TEXT,
ADD COLUMN "studentStatusChangedAt" TIMESTAMP(3);

ALTER TABLE "StudentApplication"
ADD COLUMN "dateOfBirth" TIMESTAMP(3),
ADD COLUMN "ageAtSubmission" INTEGER;

CREATE TABLE "GuardianConsent" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "guardianName" TEXT NOT NULL,
  "guardianEmail" TEXT NOT NULL,
  "relationship" "GuardianRelationship" NOT NULL,
  "status" "GuardianConsentStatus" NOT NULL DEFAULT 'INVITED',
  "verificationMethod" "GuardianVerificationMethod",
  "accessTokenHash" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
  "consentedName" TEXT,
  "parentalResponsibilityAttested" BOOLEAN NOT NULL DEFAULT false,
  "studentParticipationAuthorized" BOOLEAN NOT NULL DEFAULT false,
  "privacyAcknowledged" BOOLEAN NOT NULL DEFAULT false,
  "consentedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "provider" TEXT,
  "providerSessionId" TEXT,
  "providerStatus" TEXT,
  "providerFailureCode" TEXT,
  "adultVerified" BOOLEAN NOT NULL DEFAULT false,
  "nameMatched" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMP(3),
  "verificationCountry" TEXT,
  "alternativeRequestedAt" TIMESTAMP(3),
  "alternativeReason" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "userAgent" TEXT,
  "ipHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuardianConsent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuardianConsent_applicationId_key" ON "GuardianConsent"("applicationId");
CREATE UNIQUE INDEX "GuardianConsent_accessTokenHash_key" ON "GuardianConsent"("accessTokenHash");
CREATE UNIQUE INDEX "GuardianConsent_providerSessionId_key" ON "GuardianConsent"("providerSessionId");
CREATE INDEX "GuardianConsent_status_createdAt_idx" ON "GuardianConsent"("status","createdAt");
CREATE INDEX "GuardianConsent_guardianEmail_idx" ON "GuardianConsent"("guardianEmail");
ALTER TABLE "GuardianConsent" ADD CONSTRAINT "GuardianConsent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "StudentApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianConsent" ADD CONSTRAINT "GuardianConsent_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
