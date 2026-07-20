import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";
import { activeWithdrawalPolicy, getOrCreateFundingStanding, quoteCourseWithdrawal, recalculateFundingStanding, withdrawFromCourse } from "@/lib/funding-standing";
import { campusRestrictionResponse, studentAcademicRestrictionResponse } from "@/lib/campus-operations";
import { quoteProgramChange, withdrawAcademicProgram } from "@/lib/program-change";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  await getOrCreateFundingStanding(user.id);
  const standing = await recalculateFundingStanding(user.id);
  const [account, enrollments, programEnrollments, grades, applications, withdrawalPolicy] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { grantBalanceCents: true, studentAccountStatus: true, studentStatusReason: true, studentStatusChangedAt: true } }),
    db.courseEnrollment.findMany({ where: { userId: user.id }, include: { course: { select: { id: true, code: true, title: true, academy: true, serviceValueCents: true, estimatedDays: true } } }, orderBy: { enrolledAt: "desc" } }),
    db.programEnrollment.findMany({ where: { userId: user.id }, include: { program: { select: { id: true, code: true, title: true, level: true, creditsRequired: true } } }, orderBy: { enrolledAt: "desc" } }),
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
    db.applicationTracking.findMany({ where: { userId: user.id }, include: { programApplication: { select: { program: { select: { code: true, title: true } } } }, studentApplication: { select: { status: true } } }, orderBy: { createdAt: "desc" } }),
    activeWithdrawalPolicy(),
  ]);
  return NextResponse.json({ balanceCents: account.grantBalanceCents, studentAccountStatus: account.studentAccountStatus, studentStatusReason: account.studentStatusReason, studentStatusChangedAt: account.studentStatusChangedAt, standing, enrollments, programEnrollments, grades, applications, policy: { id: withdrawalPolicy.id, name: withdrawalPolicy.name, timeTiers: withdrawalPolicy.timeTiers, progressTiers: withdrawalPolicy.progressTiers, penaltyTiers: withdrawalPolicy.penaltyTiers, minimumRenewalPercent: 60, continuingGrade: 70, gradeReviewMinimum: 2 } });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!['withdraw', 'quote_withdrawal', 'withdraw_program', 'quote_program_withdrawal'].includes(body.action)) return NextResponse.json({ error: "Unknown Student Center action" }, { status: 400 });
  { const gate = await campusRestrictionResponse("WITHDRAWAL") || await studentAcademicRestrictionResponse(user.id, "WITHDRAWAL"); if (gate) return gate; }
  const enrollmentId = text(body.enrollmentId, 100);
  const reason = text(body.reason, 500);
  if (!enrollmentId || (body.action === 'withdraw' && reason.length < 10)) return NextResponse.json({ error: "Choose an enrollment and provide a brief withdrawal reason." }, { status: 400 });
  if (body.action === 'withdraw_program' && (reason.length < 10 || body.programChangeAcknowledged !== true)) return NextResponse.json({ error: "Provide a brief reason and acknowledge the program-withdrawal quote." }, { status: 400 });
  try {
    if (body.action === 'quote_program_withdrawal') return NextResponse.json(await quoteProgramChange(user.id, enrollmentId));
    if (body.action === 'withdraw_program') return NextResponse.json(await withdrawAcademicProgram({ userId: user.id, enrollmentId, reason }));
    return NextResponse.json(body.action === 'quote_withdrawal' ? await quoteCourseWithdrawal(user.id, enrollmentId) : await withdrawFromCourse(user.id, enrollmentId, reason));
  }
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
