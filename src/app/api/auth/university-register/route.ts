import bcrypt from "bcryptjs";
import { after, NextResponse } from "next/server";
import { createSession, currentUser } from "@/lib/auth";
import {
  admissionReviewTiming,
  processNextAdmissionReview,
} from "@/lib/admissions-automation";
import { db } from "@/lib/db";
import { email, publicUser, text } from "@/lib/input";
import { createTrackingNumber, trackingEvent } from "@/lib/application-tracking";
import { requestPolicyMetadata, recordPolicyAcceptance, validatePolicyBundle } from "@/lib/policies";
import { campusRestrictionResponse } from "@/lib/campus-operations";
import {
  createGuardianAccessToken,
  exactAge,
  parseDateOfBirth,
} from "@/lib/guardian-verification";

export const runtime = "nodejs";
export const maxDuration = 60;

function wakeAdmissionsQueue() {
  after(async () => {
    try {
      await processNextAdmissionReview();
    } catch (error) {
      console.error(
        "Admissions queue wake-up failed",
        error instanceof Error ? error.message : "Unknown queue error",
      );
    }
  });
}

const experienceLevels = new Set(["NEW", "BEGINNER", "INTERMEDIATE", "ADVANCED", "PROFESSIONAL"]);

function optionalUrl(value: unknown) {
  const cleaned = text(value, 300);
  return cleaned && /^https?:\/\//i.test(cleaned) ? cleaned : cleaned ? "INVALID" : "";
}

function validationError(
  error: string,
  code: string,
  section: number,
  field: string,
) {
  return NextResponse.json(
    { error, code, section, field },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  const campusGate = await campusRestrictionResponse("ADMISSIONS_SUBMIT");
  if (campusGate) return campusGate;
  const body = await request.json().catch(() => ({}));
  const personalEmail = email(body.email);
  const name = text(body.name, 80);
  const preferredName = text(body.preferredName, 80);
  const password = String(body.password || "");
  const specialty = text(body.specialty, 80);
  const country = text(body.country, 80);
  const timeZone = text(body.timeZone, 80);
  const dateOfBirth = parseDateOfBirth(body.dateOfBirth);
  const experienceLevel = String(body.experienceLevel || "");
  const workbenchExperience = text(body.workbenchExperience, 1600);
  const enforceExperience = text(body.enforceExperience, 1600);
  const weeklyHours = Number(body.weeklyHours);
  const learningGoals = text(body.learningGoals, 2400);
  const fundingStatement = text(body.fundingStatement, 1800);
  const supportNeeds = text(body.supportNeeds, 1200);
  const portfolioUrl = optionalUrl(body.portfolioUrl);
  const githubUrl = optionalUrl(body.githubUrl);
  const guardianName = text(body.guardianName, 100);
  const guardianEmail = email(body.guardianEmail);
  const guardianRelationship = text(body.guardianRelationship, 30).toUpperCase();
  const signedIn = await currentUser();
  if (name.length < 2)
    return validationError("Enter your full legal or public name.", "IDENTITY_NAME_REQUIRED", 0, "Full legal or public name");
  if (!personalEmail.includes("@"))
    return validationError("Enter a valid recovery email address.", "RECOVERY_EMAIL_INVALID", 0, "Recovery email");
  if (!signedIn && password.length < 12)
    return validationError("Create a password containing at least 12 characters.", "PASSWORD_TOO_SHORT", 0, "Create a secure password");
  if (!country)
    return validationError("Enter your country or region.", "COUNTRY_REQUIRED", 0, "Country or region");
  if (!timeZone)
    return validationError("Enter your time zone.", "TIME_ZONE_REQUIRED", 0, "Time zone");
  if (!dateOfBirth)
    return validationError("Enter a valid date of birth.", "DATE_OF_BIRTH_REQUIRED", 0, "Date of birth");
  const applicantAge = exactAge(dateOfBirth);
  if (applicantAge < 16)
    return validationError("Online admission is currently available to applicants age 16 and older.", "MINIMUM_AGE_REQUIRED", 0, "Date of birth");
  if (applicantAge > 120)
    return validationError("Review the date of birth and enter the correct year.", "DATE_OF_BIRTH_INVALID", 0, "Date of birth");
  const guardianRequired = applicantAge === 16 || applicantAge === 17;
  if (guardianRequired && process.env.MINOR_ADMISSIONS_ENABLED === "false")
    return NextResponse.json({ error: "Admissions for applicants age 16 or 17 are temporarily unavailable while guardian verification is being configured.", code: "MINOR_ADMISSIONS_PAUSED", section: 0, field: "Date of birth" }, { status: 503 });
  if (guardianRequired && guardianName.length < 2)
    return validationError("Enter the full legal name of a parent or legal guardian.", "GUARDIAN_NAME_REQUIRED", 0, "Parent or guardian name");
  if (guardianRequired && !guardianEmail.includes("@"))
    return validationError("Enter a valid parent or guardian email address.", "GUARDIAN_EMAIL_REQUIRED", 0, "Parent or guardian email");
  if (guardianRequired && !["PARENT", "LEGAL_GUARDIAN", "OTHER_GUARDIAN"].includes(guardianRelationship))
    return validationError("Choose the parent or guardian relationship.", "GUARDIAN_RELATIONSHIP_REQUIRED", 0, "Relationship");
  if (guardianRequired && body.guardianContactAuthorized !== true)
    return validationError("Confirm that the named adult may be contacted for this application.", "GUARDIAN_CONTACT_AUTHORIZATION_REQUIRED", 0, "Guardian contact authorization");
  if (!experienceLevels.has(experienceLevel))
    return validationError("Choose your current experience level.", "EXPERIENCE_LEVEL_REQUIRED", 1, "Experience level");
  if (!Number.isInteger(weeklyHours) || weeklyHours < 1 || weeklyHours > 60)
    return validationError("Weekly study availability must be between 1 and 60 hours.", "WEEKLY_HOURS_INVALID", 1, "Weekly study availability");
  if (workbenchExperience.length < 20)
    return validationError("Describe your Workbench experience in at least 20 characters.", "WORKBENCH_EXPERIENCE_REQUIRED", 1, "Arma Reforger Workbench experience");
  if (enforceExperience.length < 20)
    return validationError("Describe your programming experience or explain what you want to learn in at least 20 characters.", "PROGRAMMING_EXPERIENCE_REQUIRED", 1, "Enforce Script or programming experience");
  if (learningGoals.length < 80)
    return validationError("Describe your learning goals in at least 80 characters.", "LEARNING_GOALS_REQUIRED", 2, "Learning goals and professional direction");
  if (fundingStatement.length < 40)
    return validationError("Describe how sponsored access will support your studies in at least 40 characters.", "FUNDING_STATEMENT_REQUIRED", 3, "Sponsored access statement");
  if (portfolioUrl === "INVALID")
    return validationError("The portfolio or Workshop link must be a complete http or https URL.", "PORTFOLIO_URL_INVALID", 1, "Portfolio or Workshop page");
  if (githubUrl === "INVALID")
    return validationError("The GitHub link must be a complete http or https URL.", "GITHUB_URL_INVALID", 1, "GitHub profile");
  if (body.acceptPolicies !== true)
    return validationError("Certify that your application is accurate to continue.", "APPLICATION_CERTIFICATION_REQUIRED", 4, "Application certification");
  if (body.bundleAccepted !== true)
    return validationError("Accept the complete listed policy bundle before signing.", "POLICY_BUNDLE_REQUIRED", 5, "Policy bundle acceptance");
  const policyValidation = await validatePolicyBundle({
    policyVersionIds: Array.isArray(body.policyVersionIds) ? body.policyVersionIds.map(String) : [],
    signerName: text(body.signerName, 100),
    expectedName: name,
    ageAttested: body.ageAttested === true,
    electronicConsent: body.electronicConsent === true,
  });
  if (!policyValidation.ok) return NextResponse.json({ error: policyValidation.error, code: policyValidation.code, section: 5, field: "Electronic signature" }, { status: policyValidation.status });
  if (guardianRequired) {
    const guardianPolicySlugs = new Set(["terms-of-service", "ai-automated-systems", "privacy-student-data", "electronic-records-signature"]);
    const missingGuardianPolicy = policyValidation.policies.some((policy) => guardianPolicySlugs.has(policy.slug) && policy.currentVersion.version < 3);
    if (missingGuardianPolicy)
      return NextResponse.json({ error: "Admissions for applicants age 16 or 17 will open after the guardian-consent policy revisions complete legal review and publication.", code: "GUARDIAN_POLICIES_NOT_PUBLISHED", section: 5, field: "Policy bundle" }, { status: 503 });
  }
  const policyVersionIds = policyValidation.policies.map((policy) => policy.currentVersion.id);
  const signatureMetadata = requestPolicyMetadata(request);

  if (signedIn?.isStudent) return NextResponse.json({ error: "This account is already enrolled at Enfusion University." }, { status: 409 });
  if (signedIn && signedIn.email !== personalEmail) return NextResponse.json({ error: "Use the recovery email attached to your signed-in university account." }, { status: 409 });
  if (!signedIn && await db.user.findFirst({ where: { OR: [{ email: personalEmail }, { academicEmail: personalEmail }] } })) return NextResponse.json({ error: "An account already exists for that email. Sign in to resume its application." }, { status: 409 });

  if (signedIn) {
    const existing = await db.studentApplication.findUnique({ where: { userId: signedIn.id }, include: { trackingRecords: { orderBy: { createdAt: "desc" }, take: 1 } } });
    if (existing) {
      const tracker = existing.trackingRecords[0];
      return NextResponse.json({ user: signedIn, application: { trackingNumber: tracker?.trackingNumber, status: existing.status, submittedAt: existing.submittedAt, statusUrl: "/admissions/status" }, idempotentReplay: true }, { status: 202 });
    }
  }

  const guardianAccess = guardianRequired
    ? (() => {
        try { return createGuardianAccessToken(); }
        catch { return null; }
      })()
    : null;
  if (guardianRequired && !guardianAccess)
    return NextResponse.json({ error: "Guardian verification is not configured. Your application has not been submitted; contact admissions after the secure consent service is enabled.", code: "GUARDIAN_VERIFICATION_NOT_CONFIGURED", section: 0, field: "Parent or guardian" }, { status: 503 });

  const applicationTrackingNumber = createTrackingNumber("ADMISSION");
  const applicationData = { preferredName: preferredName || null, country, timeZone, experienceLevel, workbenchExperience, enforceExperience, weeklyHours, learningGoals, portfolioUrl: portfolioUrl || null, githubUrl: githubUrl || null, fundingStatement, supportNeeds: supportNeeds || null, dateOfBirth, ageAtSubmission: applicantAge, status: guardianRequired ? "GUARDIAN_CONSENT_REQUIRED" as const : "UNDER_AUTOMATED_REVIEW" as const };
  const reviewTiming = admissionReviewTiming(applicationData);
  const user = await db.$transaction(async (tx) => {
    const applicant = signedIn
      ? await tx.user.update({ where: { id: signedIn.id }, data: { name, specialty: specialty || signedIn.specialty } })
      : await tx.user.create({ data: { email: personalEmail, name, passwordHash: await bcrypt.hash(password, 12), specialty: specialty || null } });
    const application = await tx.studentApplication.create({ data: { userId: applicant.id, ...applicationData } });
    await tx.applicationTracking.create({ data: { trackingNumber: applicationTrackingNumber, userId: applicant.id, type: "ADMISSION", status: "IN_REVIEW", studentApplicationId: application.id, submittedAt: application.submittedAt, statusHistory: [trackingEvent("SUBMITTED", "University application received"), trackingEvent(guardianRequired ? "GUARDIAN_CONSENT_REQUIRED" : "UNDER_AUTOMATED_REVIEW", guardianRequired ? "A parent or legal guardian must complete separate consent and adult identity verification" : "Eligibility, readiness, policy, and integrity review queued")] } });
    await tx.admissionReviewJob.create({ data: { applicationId: application.id, status: guardianRequired ? "WAITING_FOR_GUARDIAN" : "QUEUED", stage: guardianRequired ? "GUARDIAN_PERMISSION" : "APPLICATION_RECEIVED", idempotencyKey: `admission-review:${application.id}:r0`, availableAt: reviewTiming.availableAt, maxAttempts: Number(process.env.ADMISSIONS_MAX_RETRIES || 3), lastError: guardianRequired ? "Verified guardian consent required before admissions review." : null } });
    if (guardianRequired && guardianAccess) {
      await tx.guardianConsent.create({ data: { applicationId: application.id, guardianName, guardianEmail, relationship: guardianRelationship as "PARENT" | "LEGAL_GUARDIAN" | "OTHER_GUARDIAN", accessTokenHash: guardianAccess.accessTokenHash, tokenExpiresAt: guardianAccess.tokenExpiresAt } });
    }
    const signature = await recordPolicyAcceptance({ client: tx, userId: applicant.id, applicantEmail: personalEmail, signerName: text(body.signerName, 100), ageAttested: true, electronicConsent: true, policyVersionIds, ...signatureMetadata });
    await tx.auditLog.create({ data: { actorId: applicant.id, action: "UNIVERSITY_APPLICATION_SUBMITTED", entity: "StudentApplication", entityId: application.id, detail: { trackingNumber: applicationTrackingNumber, applicantAge, guardianRequired, reviewMethod: "CHARACTER_COUNT_DURATION", characterCount: reviewTiming.characterCount, reviewAvailableAt: reviewTiming.availableAt } } });
    await tx.auditLog.create({ data: { actorId: applicant.id, action: "ADMISSIONS_POLICY_BUNDLE_SIGNED", entity: "PolicySignatureEvent", entityId: signature.id, detail: { receiptNumber: signature.receiptNumber, policyVersionIds } } });
    return applicant;
  });
  if (!signedIn) await createSession(user.id);
  if (!guardianRequired) wakeAdmissionsQueue();
  return NextResponse.json({
    user: publicUser(user),
    application: {
      trackingNumber: applicationTrackingNumber,
      status: guardianRequired ? "GUARDIAN_CONSENT_REQUIRED" : "UNDER_AUTOMATED_REVIEW",
      submittedAt: new Date(),
      statusUrl: "/admissions/status",
      guardianConsentRequired: guardianRequired,
      stages: ["APPLICATION_RECEIVED", ...(guardianRequired ? ["GUARDIAN_PERMISSION"] : []), "IDENTITY_ELIGIBILITY", "ACADEMIC_READINESS", "POLICY_INTEGRITY", "DECISION_PREPARATION"],
    },
  }, { status: 202 });
}
