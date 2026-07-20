import { after, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import {
  admissionAwardSummary,
  processNextAdmissionReview,
} from "@/lib/admissions-automation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function wakeAdmissionsQueue() {
  after(async () => {
    try {
      await processNextAdmissionReview();
    } catch (error) {
      console.error(
        "Admissions status queue wake-up failed",
        error instanceof Error ? error.message : "Unknown queue error",
      );
    }
  });
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in with the recovery email used on your application." }, { status: 401 });
  const application = await db.studentApplication.findUnique({
    where: { userId: user.id },
    include: {
      trackingRecords: { orderBy: { createdAt: "desc" }, take: 1 },
      reviewJobs: { include: { decision: true }, orderBy: { createdAt: "desc" } },
      clarifications: { orderBy: { round: "asc" } },
      guardianConsent: true,
    },
  });
  if (!application) return NextResponse.json({ error: "No admissions application is attached to this account." }, { status: 404 });
  const tracker = application.trackingRecords[0];
  const latestJob = application.reviewJobs[0];
  if (
    latestJob?.status === "QUEUED" &&
    latestJob.availableAt.getTime() <= Date.now()
  )
    wakeAdmissionsQueue();
  const currentClarification = [...application.clarifications].reverse().find((item) => !item.submittedAt) || null;
  const award = application.status === "ADMITTED" && user.academicEmail && user.studentNumber && tracker
    ? admissionAwardSummary(user.academicEmail, user.studentNumber, tracker.trackingNumber)
    : null;
  return NextResponse.json({
    application: {
      status: application.status,
      submittedAt: application.submittedAt,
      reviewedAt: application.reviewedAt,
      trackingNumber: tracker?.trackingNumber,
      trackingStatus: tracker?.status,
      history: Array.isArray(tracker?.statusHistory) ? tracker.statusHistory : [],
      closedAt: tracker?.closedAt,
      lastUpdatedAt: tracker?.updatedAt || application.submittedAt,
      profile: {
        preferredName: application.preferredName,
        country: application.country,
        timeZone: application.timeZone,
        experienceLevel: application.experienceLevel,
        weeklyHours: application.weeklyHours,
        learningGoals: application.learningGoals,
        workbenchExperience: application.workbenchExperience,
        enforceExperience: application.enforceExperience,
        fundingStatement: application.fundingStatement,
        portfolioUrl: application.portfolioUrl,
        githubUrl: application.githubUrl,
        concentration: user.specialty,
      },
    },
    review: latestJob ? {
      status: latestJob.status,
      stage: latestJob.stage,
      attempt: latestJob.attempt,
      maxAttempts: latestJob.maxAttempts,
      updatedAt: latestJob.updatedAt,
      decision: latestJob.decision ? {
        outcome: latestJob.decision.outcome,
        strengths: Array.isArray(latestJob.decision.strengths) ? latestJob.decision.strengths : [],
        concerns: Array.isArray(latestJob.decision.concerns) ? latestJob.decision.concerns : [],
      } : null,
    } : null,
    clarification: currentClarification ? { id: currentClarification.id, round: currentClarification.round, questions: currentClarification.questions } : null,
    policyActionUrl: latestJob?.status === "WAITING_FOR_CONSENT" ? "/policies/accept" : null,
    guardian: application.guardianConsent ? {
      required: true,
      status: application.guardianConsent.status,
      guardianName: application.guardianConsent.guardianName,
      relationship: application.guardianConsent.relationship,
      expiresAt: application.guardianConsent.tokenExpiresAt,
      verifiedAt: application.guardianConsent.verifiedAt,
      failureCode: application.guardianConsent.providerFailureCode,
      alternativeRequestedAt: application.guardianConsent.alternativeRequestedAt,
      canCreateInvitation: application.guardianConsent.status !== "VERIFIED",
    } : null,
    award,
  });
}
