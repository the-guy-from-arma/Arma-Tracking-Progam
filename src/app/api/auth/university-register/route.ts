import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession, currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { email, publicUser, text } from "@/lib/input";
import { createTrackingNumber, trackingEvent } from "@/lib/application-tracking";
import { requestPolicyMetadata, recordPolicyAcceptance, validatePolicyBundle } from "@/lib/policies";
import { campusRestrictionResponse } from "@/lib/campus-operations";

const experienceLevels = new Set(["NEW", "BEGINNER", "INTERMEDIATE", "ADVANCED", "PROFESSIONAL"]);

function optionalUrl(value: unknown) {
  const cleaned = text(value, 300);
  return cleaned && /^https?:\/\//i.test(cleaned) ? cleaned : cleaned ? "INVALID" : "";
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
  const experienceLevel = String(body.experienceLevel || "");
  const workbenchExperience = text(body.workbenchExperience, 1600);
  const enforceExperience = text(body.enforceExperience, 1600);
  const weeklyHours = Number(body.weeklyHours);
  const learningGoals = text(body.learningGoals, 2400);
  const fundingStatement = text(body.fundingStatement, 1800);
  const supportNeeds = text(body.supportNeeds, 1200);
  const portfolioUrl = optionalUrl(body.portfolioUrl);
  const githubUrl = optionalUrl(body.githubUrl);
  if (!personalEmail.includes("@") || name.length < 2 || password.length < 12) return NextResponse.json({ error: "Complete your name, recovery email, and a password of at least 12 characters." }, { status: 400 });
  if (!country || !timeZone || !experienceLevels.has(experienceLevel) || !Number.isInteger(weeklyHours) || weeklyHours < 1 || weeklyHours > 60) return NextResponse.json({ error: "Complete your location, time zone, experience level, and weekly availability." }, { status: 400 });
  if (workbenchExperience.length < 20 || enforceExperience.length < 20 || learningGoals.length < 80 || fundingStatement.length < 40) return NextResponse.json({ error: "Provide detailed experience, learning goals, and sponsorship statements." }, { status: 400 });
  if (portfolioUrl === "INVALID" || githubUrl === "INVALID") return NextResponse.json({ error: "Portfolio and GitHub links must be complete http or https URLs." }, { status: 400 });
  if (body.acceptPolicies !== true) return NextResponse.json({ error: "Certify that your application is accurate to continue." }, { status: 400 });
  if (body.bundleAccepted !== true) return NextResponse.json({ error: "Accept the complete listed policy bundle before signing." }, { status: 400 });
  const policyValidation = await validatePolicyBundle({
    policyVersionIds: Array.isArray(body.policyVersionIds) ? body.policyVersionIds.map(String) : [],
    signerName: text(body.signerName, 100),
    expectedName: name,
    ageAttested: body.ageAttested === true,
    electronicConsent: body.electronicConsent === true,
  });
  if (!policyValidation.ok) return NextResponse.json({ error: policyValidation.error, code: policyValidation.code }, { status: policyValidation.status });
  const policyVersionIds = policyValidation.policies.map((policy) => policy.currentVersion.id);
  const signatureMetadata = requestPolicyMetadata(request);

  const signedIn = await currentUser();
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

  const applicationTrackingNumber = createTrackingNumber("ADMISSION");
  const applicationData = { preferredName: preferredName || null, country, timeZone, experienceLevel, workbenchExperience, enforceExperience, weeklyHours, learningGoals, portfolioUrl: portfolioUrl || null, githubUrl: githubUrl || null, fundingStatement, supportNeeds: supportNeeds || null, status: "UNDER_AUTOMATED_REVIEW" as const };
  const user = await db.$transaction(async (tx) => {
    const applicant = signedIn
      ? await tx.user.update({ where: { id: signedIn.id }, data: { name, specialty: specialty || signedIn.specialty } })
      : await tx.user.create({ data: { email: personalEmail, name, passwordHash: await bcrypt.hash(password, 12), specialty: specialty || null } });
    const application = await tx.studentApplication.create({ data: { userId: applicant.id, ...applicationData } });
    await tx.applicationTracking.create({ data: { trackingNumber: applicationTrackingNumber, userId: applicant.id, type: "ADMISSION", status: "IN_REVIEW", studentApplicationId: application.id, submittedAt: application.submittedAt, statusHistory: [trackingEvent("SUBMITTED", "University application received"), trackingEvent("UNDER_AUTOMATED_REVIEW", "Eligibility, readiness, policy, and integrity review queued")] } });
    await tx.admissionReviewJob.create({ data: { applicationId: application.id, idempotencyKey: `admission-review:${application.id}:r0`, maxAttempts: Number(process.env.ADMISSIONS_MAX_RETRIES || 3) } });
    const signature = await recordPolicyAcceptance({ client: tx, userId: applicant.id, applicantEmail: personalEmail, signerName: text(body.signerName, 100), ageAttested: true, electronicConsent: true, policyVersionIds, ...signatureMetadata });
    await tx.auditLog.create({ data: { actorId: applicant.id, action: "UNIVERSITY_APPLICATION_SUBMITTED", entity: "StudentApplication", entityId: application.id, detail: { trackingNumber: applicationTrackingNumber, reviewMode: process.env.ADMISSIONS_AUTOMATION_MODE || "SHADOW" } } });
    await tx.auditLog.create({ data: { actorId: applicant.id, action: "ADMISSIONS_POLICY_BUNDLE_SIGNED", entity: "PolicySignatureEvent", entityId: signature.id, detail: { receiptNumber: signature.receiptNumber, policyVersionIds } } });
    return applicant;
  });
  if (!signedIn) await createSession(user.id);
  const slaMinutes = Math.max(2, Math.min(60, Number(process.env.ADMISSIONS_REVIEW_SLA_MINUTES || 10)));
  return NextResponse.json({
    user: publicUser(user),
    application: {
      trackingNumber: applicationTrackingNumber,
      status: "UNDER_AUTOMATED_REVIEW",
      submittedAt: new Date(),
      estimatedDecisionAt: new Date(Date.now() + slaMinutes * 60_000),
      statusUrl: "/admissions/status",
      stages: ["APPLICATION_RECEIVED", "IDENTITY_ELIGIBILITY", "ACADEMIC_READINESS", "POLICY_INTEGRITY", "DECISION_PREPARATION"],
    },
  }, { status: 202 });
}
