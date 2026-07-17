import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession, currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { email, publicUser, text } from "@/lib/input";
import { createTrackingNumber, trackingEvent } from "@/lib/application-tracking";

const INITIAL_GRANT_CENTS = 5_000_000;
const ESTIMATED_PROGRAM_VALUE_CENTS = 4_275_000;
const experienceLevels = new Set(["NEW", "BEGINNER", "INTERMEDIATE", "ADVANCED", "PROFESSIONAL"]);

function identityDomain() {
  return String(process.env.UNIVERSITY_IDENTITY_DOMAIN || "enfusionuniversity.edu").trim().toLowerCase().replace(/^@/, "");
}

function aliasFor(name: string, studentNumber: string) {
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, "").trim().split(/\s+/).filter(Boolean);
  const readable = base.length > 1 ? `${base[0]}.${base.at(-1)}` : base[0] || "student";
  return `${readable}${studentNumber.slice(-4)}`;
}

function optionalUrl(value: unknown) {
  const cleaned = text(value, 300);
  return cleaned && /^https?:\/\//i.test(cleaned) ? cleaned : cleaned ? "INVALID" : "";
}

function awardSummary(academicIdentity: string, studentNumber: string, applicationTrackingNumber: string) {
  return {
    academicIdentity,
    studentNumber,
    applicationTrackingNumber,
    estimatedProgramValueCents: ESTIMATED_PROGRAM_VALUE_CENTS,
    grantAwardCents: INITIAL_GRANT_CENTS,
    studentDueCents: 0,
    availableGrantBalanceCents: INITIAL_GRANT_CENTS,
    breakdown: [
      { label: "Digital instruction and academic services", amountCents: 1_800_000 },
      { label: "Studio mentorship and technical review", amountCents: 1_200_000 },
      { label: "Workbench e-services and learning infrastructure", amountCents: 675_000 },
      { label: "Portfolio assessment and credential services", amountCents: 600_000 },
    ],
    disclosure: "Estimated sponsored-service values are internal program estimates. The grant is non-cash, is not federal student aid, creates no debt, and may only be allocated to Enfusion University learning services.",
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const personalEmail = email(body.email); const name = text(body.name, 80); const preferredName = text(body.preferredName, 80); const password = String(body.password || ""); const specialty = text(body.specialty, 80);
  const country = text(body.country, 80); const timeZone = text(body.timeZone, 80); const experienceLevel = String(body.experienceLevel || ""); const workbenchExperience = text(body.workbenchExperience, 1600); const enforceExperience = text(body.enforceExperience, 1600); const weeklyHours = Number(body.weeklyHours); const learningGoals = text(body.learningGoals, 2400); const fundingStatement = text(body.fundingStatement, 1800); const supportNeeds = text(body.supportNeeds, 1200); const portfolioUrl = optionalUrl(body.portfolioUrl); const githubUrl = optionalUrl(body.githubUrl);
  if (!personalEmail.includes("@") || name.length < 2 || password.length < 10) return NextResponse.json({ error: "Complete your name, recovery email, and a password of at least 10 characters." }, { status: 400 });
  if (!country || !timeZone || !experienceLevels.has(experienceLevel) || !Number.isInteger(weeklyHours) || weeklyHours < 1 || weeklyHours > 60) return NextResponse.json({ error: "Complete your location, time zone, experience level, and weekly availability." }, { status: 400 });
  if (workbenchExperience.length < 20 || enforceExperience.length < 20 || learningGoals.length < 80 || fundingStatement.length < 40) return NextResponse.json({ error: "Provide detailed experience, learning goals, and sponsorship statements." }, { status: 400 });
  if (portfolioUrl === "INVALID" || githubUrl === "INVALID") return NextResponse.json({ error: "Portfolio and GitHub links must be complete http or https URLs." }, { status: 400 });
  if (body.acceptPolicies !== true || body.grantAcknowledgement !== true) return NextResponse.json({ error: "Accept the academic policies and non-cash grant disclosure to continue." }, { status: 400 });

  const signedIn = await currentUser();
  if (signedIn?.isStudent) return NextResponse.json({ error: "This account is already enrolled at Enfusion University." }, { status: 409 });
  if (signedIn && signedIn.email !== personalEmail) return NextResponse.json({ error: "Use the recovery email attached to your signed-in VALORIS account." }, { status: 409 });
  if (!signedIn && await db.user.findFirst({ where: { OR: [{ email: personalEmail }, { academicEmail: personalEmail }] } })) return NextResponse.json({ error: "An account already exists for that email. Sign in before applying to the university." }, { status: 409 });

  const studentNumber = `EFU-${new Date().getUTCFullYear()}-${crypto.randomInt(100000, 999999)}`;
  const academicIdentity = `${aliasFor(name, studentNumber)}@${identityDomain()}`;
  const applicationTrackingNumber = createTrackingNumber("ADMISSION");
  const applicationData = { preferredName: preferredName || null, country, timeZone, experienceLevel, workbenchExperience, enforceExperience, weeklyHours, learningGoals, portfolioUrl: portfolioUrl || null, githubUrl: githubUrl || null, fundingStatement, supportNeeds: supportNeeds || null, status: "ADMITTED" as const, reviewedAt: new Date() };

  const user = await db.$transaction(async (tx) => {
    const admitted = signedIn ? await tx.user.update({ where: { id: signedIn.id }, data: { academicEmail: academicIdentity, studentNumber, isStudent: true, name, specialty: specialty || signedIn.specialty, grantBalanceCents: INITIAL_GRANT_CENTS } }) : await tx.user.create({ data: { email: personalEmail, academicEmail: academicIdentity, studentNumber, isStudent: true, name, passwordHash: await bcrypt.hash(password, 12), specialty: specialty || null, grantBalanceCents: INITIAL_GRANT_CENTS } });
    const application = await tx.studentApplication.create({ data: { userId: admitted.id, ...applicationData } });
    await tx.applicationTracking.create({ data: { trackingNumber: applicationTrackingNumber, userId: admitted.id, type: "ADMISSION", status: "CLOSED", studentApplicationId: application.id, outcome: "ADMITTED", submittedAt: application.submittedAt, closedAt: application.reviewedAt, statusHistory: [trackingEvent("SUBMITTED", "University application received"), trackingEvent("ADMITTED", "Student identity and sponsored learning account activated")] } });
    await tx.grantLedger.create({ data: { userId: admitted.id, type: "INITIAL_AWARD", amountCents: INITIAL_GRANT_CENTS, description: "Thunder Buddies Studios Sponsored Learning Grant" } });
    await tx.auditLog.create({ data: { actorId: admitted.id, action: "UNIVERSITY_STUDENT_ADMITTED", entity: "User", entityId: admitted.id, detail: { studentNumber, academicIdentity, grantAwardCents: INITIAL_GRANT_CENTS, estimatedProgramValueCents: ESTIMATED_PROGRAM_VALUE_CENTS } } });
    return admitted;
  });
  if (!signedIn) await createSession(user.id);
  return NextResponse.json({ user: publicUser(user), award: awardSummary(academicIdentity, studentNumber, applicationTrackingNumber) }, { status: 201 });
}
