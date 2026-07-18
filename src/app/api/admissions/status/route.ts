import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { admissionAwardSummary } from "@/lib/admissions-automation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in with the recovery email used on your application." }, { status: 401 });
  const application = await db.studentApplication.findUnique({
    where: { userId: user.id },
    include: {
      trackingRecords: { orderBy: { createdAt: "desc" }, take: 1 },
      reviewJobs: { include: { decision: true }, orderBy: { createdAt: "desc" } },
      clarifications: { orderBy: { round: "asc" } },
    },
  });
  if (!application) return NextResponse.json({ error: "No admissions application is attached to this account." }, { status: 404 });
  const tracker = application.trackingRecords[0];
  const latestJob = application.reviewJobs[0];
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
      history: tracker?.statusHistory || [],
    },
    review: latestJob ? {
      status: latestJob.status,
      stage: latestJob.stage,
      attempt: latestJob.attempt,
      availableAt: latestJob.availableAt,
      updatedAt: latestJob.updatedAt,
      decision: latestJob.decision ? { outcome: latestJob.decision.outcome, strengths: latestJob.decision.strengths, concerns: latestJob.decision.concerns } : null,
    } : null,
    clarification: currentClarification ? { id: currentClarification.id, round: currentClarification.round, questions: currentClarification.questions } : null,
    policyActionUrl: latestJob?.status === "WAITING_FOR_CONSENT" ? "/policies/accept" : null,
    award,
  });
}
