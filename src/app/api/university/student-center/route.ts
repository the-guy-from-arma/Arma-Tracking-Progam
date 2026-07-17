import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";
import { getOrCreateFundingStanding, recalculateFundingStanding, withdrawFromCourse } from "@/lib/funding-standing";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  await getOrCreateFundingStanding(user.id);
  const standing = await recalculateFundingStanding(user.id);
  const [account, enrollments, grades] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { grantBalanceCents: true } }),
    db.courseEnrollment.findMany({ where: { userId: user.id }, include: { course: { select: { id: true, code: true, title: true, academy: true, serviceValueCents: true, estimatedDays: true } } }, orderBy: { enrolledAt: "desc" } }),
    db.aiGradeDecision.findMany({
      where: { submission: { studentId: user.id } },
      include: {
        submission: {
          select: {
            status: true,
            course: { select: { code: true, title: true } },
            appeals: { orderBy: { submittedAt: "desc" }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  return NextResponse.json({ balanceCents: account.grantBalanceCents, standing, enrollments, grades, policy: { withdrawalReturnPercent: 30, withdrawalPenaltyPercent: 5, minimumRenewalPercent: 60, continuingGrade: 70, gradeReviewMinimum: 2 } });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (body.action !== "withdraw") return NextResponse.json({ error: "Unknown Student Center action" }, { status: 400 });
  const enrollmentId = text(body.enrollmentId, 100);
  const reason = text(body.reason, 500);
  if (!enrollmentId || reason.length < 10) return NextResponse.json({ error: "Choose an enrollment and provide a brief withdrawal reason." }, { status: 400 });
  try { return NextResponse.json(await withdrawFromCourse(user.id, enrollmentId, reason)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Withdrawal could not be completed." }, { status: 409 }); }
}

export async function PATCH(request: Request) {
  const owner = await currentUser();
  if (!owner || !isAdmin(owner.role)) return NextResponse.json({ error: "Owner or administrator authority required" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const userId = text(body.userId, 100);
  const reason = text(body.reason, 500);
  const multiplier = body.multiplierPercent == null ? null : Number(body.multiplierPercent);
  if (!userId || reason.length < 10 || (multiplier != null && (!Number.isFinite(multiplier) || multiplier < 60 || multiplier > 100))) return NextResponse.json({ error: "Provide a student, a 60–100% multiplier (or null), and an override reason." }, { status: 400 });
  await getOrCreateFundingStanding(userId);
  await db.studentFundingStanding.update({ where: { userId }, data: { ownerOverrideMultiplierBps: multiplier == null ? null : Math.round(multiplier * 100), ownerOverrideReason: reason } });
  const standing = await recalculateFundingStanding(userId);
  await db.auditLog.create({ data: { actorId: owner.id, action: "FUNDING_STANDING_OVERRIDE", entity: "User", entityId: userId, detail: { multiplierPercent: multiplier, reason } } });
  return NextResponse.json({ standing });
}
