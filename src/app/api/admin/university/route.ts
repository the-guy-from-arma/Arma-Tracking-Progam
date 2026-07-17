import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";

const decisions = new Set(["ADMITTED", "WAITLISTED", "DECLINED"]);
const MAX_ADJUSTMENT_CENTS = 25_000_000;

async function requireOwner() {
  const user = await currentUser();
  return user?.role === "OWNER" ? user : null;
}

export async function GET() {
  const owner = await requireOwner();
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 403 });

  const [applications, ledger, totals] = await Promise.all([
    db.studentApplication.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            academicEmail: true,
            studentNumber: true,
            specialty: true,
            grantBalanceCents: true,
            suspended: true,
            createdAt: true,
            _count: { select: { courseEnrollments: true, certificates: true } },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    }),
    db.grantLedger.findMany({
      include: { user: { select: { name: true, studentNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.user.aggregate({ where: { isStudent: true }, _sum: { grantBalanceCents: true }, _count: { id: true } }),
  ]);

  const byStatus = applications.reduce<Record<string, number>>((result, application) => {
    result[application.status] = (result[application.status] || 0) + 1;
    return result;
  }, {});

  return NextResponse.json({
    applications,
    ledger,
    summary: {
      students: totals._count.id,
      availableFundingCents: totals._sum.grantBalanceCents || 0,
      submitted: byStatus.SUBMITTED || 0,
      admitted: byStatus.ADMITTED || 0,
      waitlisted: byStatus.WAITLISTED || 0,
      declined: byStatus.DECLINED || 0,
    },
  });
}

export async function PATCH(request: Request) {
  const owner = await requireOwner();
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const applicationId = text(body.applicationId, 80);
  const action = text(body.action, 40);
  const note = text(body.note, 500);
  if (!applicationId) return NextResponse.json({ error: "Application is required." }, { status: 400 });

  const application = await db.studentApplication.findUnique({ where: { id: applicationId }, include: { user: true } });
  if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  if (action === "set_status") {
    const status = text(body.status, 30).toUpperCase();
    if (!decisions.has(status)) return NextResponse.json({ error: "Choose a valid admissions decision." }, { status: 400 });
    const updated = await db.$transaction(async (tx) => {
      const record = await tx.studentApplication.update({
        where: { id: application.id },
        data: { status: status as "ADMITTED" | "WAITLISTED" | "DECLINED", reviewedAt: new Date() },
      });
      await tx.auditLog.create({ data: { actorId: owner.id, action: "UNIVERSITY_APPLICATION_DECISION", entity: "StudentApplication", entityId: application.id, detail: { status, note, studentId: application.userId } } });
      return record;
    });
    return NextResponse.json({ application: updated });
  }

  if (action === "adjust_funding") {
    const amountCents = Math.round(Number(body.amountDollars) * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents === 0 || Math.abs(amountCents) > MAX_ADJUSTMENT_CENTS) {
      return NextResponse.json({ error: "Enter a non-zero adjustment no greater than $250,000." }, { status: 400 });
    }
    if (note.length < 5) return NextResponse.json({ error: "Add a reason for the funding adjustment." }, { status: 400 });
    const nextBalance = application.user.grantBalanceCents + amountCents;
    if (nextBalance < 0) return NextResponse.json({ error: "This adjustment would make the student balance negative." }, { status: 400 });

    const updated = await db.$transaction(async (tx) => {
      const student = await tx.user.update({ where: { id: application.userId }, data: { grantBalanceCents: { increment: amountCents } } });
      await tx.grantLedger.create({ data: { userId: application.userId, type: amountCents > 0 ? "SUPPLEMENTAL_AWARD" : "ADJUSTMENT", amountCents, description: note } });
      await tx.auditLog.create({ data: { actorId: owner.id, action: "UNIVERSITY_FUNDING_ADJUSTED", entity: "User", entityId: application.userId, detail: { amountCents, previousBalanceCents: application.user.grantBalanceCents, nextBalanceCents: student.grantBalanceCents, note } } });
      return student;
    });
    return NextResponse.json({ grantBalanceCents: updated.grantBalanceCents });
  }

  return NextResponse.json({ error: "Unknown owner action." }, { status: 400 });
}
