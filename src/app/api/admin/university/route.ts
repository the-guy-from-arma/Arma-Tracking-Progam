import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";
import { finalizeAdmission } from "@/lib/admissions-automation";

const decisions = new Set(["ADMITTED", "WAITLISTED", "DECLINED"]);
const MAX_ADJUSTMENT_CENTS = 25_000_000;

async function requireOwner() {
  const user = await currentUser();
  return user?.role === "OWNER" ? user : null;
}

export async function GET() {
  const owner = await requireOwner();
  if (!owner)
    return NextResponse.json(
      { error: "Owner access required." },
      { status: 403 },
    );

  const [applications, totals, faculty] = await Promise.all([
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
    db.user.aggregate({
      where: { isStudent: true },
      _sum: { grantBalanceCents: true },
      _count: { id: true },
    }),
    db.user.findMany({
      where: { role: "FACULTY" },
      select: {
        id: true,
        name: true,
        email: true,
        academicEmail: true,
        specialty: true,
        suspended: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const byStatus = applications.reduce<Record<string, number>>(
    (result, application) => {
      result[application.status] = (result[application.status] || 0) + 1;
      return result;
    },
    {},
  );

  return NextResponse.json({
    applications,
    faculty,
    ledger: [],
    curriculumCoverage: { attention: [], unmapped: 0, warnings: 0 },
    summary: {
      students: totals._count.id,
      availableFundingCents: totals._sum.grantBalanceCents || 0,
      submitted: (byStatus.SUBMITTED || 0) + (byStatus.UNDER_AUTOMATED_REVIEW || 0) + (byStatus.CLARIFICATION_REQUIRED || 0) + (byStatus.AUTOMATION_EXCEPTION || 0),
      admitted: byStatus.ADMITTED || 0,
      waitlisted: byStatus.WAITLISTED || 0,
      declined: byStatus.DECLINED || 0,
    },
  });
}

export async function POST(request: Request) {
  const owner = await requireOwner();
  if (!owner)
    return NextResponse.json(
      { error: "Owner access required." },
      { status: 403 },
    );
  const body = await request.json().catch(() => ({}));
  const name = text(body.name, 100);
  const recoveryEmail = text(body.email, 180).toLowerCase();
  const specialty = text(body.specialty, 160);
  const password = String(body.password || "");
  if (
    name.length < 2 ||
    !/^\S+@\S+\.\S+$/.test(recoveryEmail) ||
    specialty.length < 3
  )
    return NextResponse.json(
      {
        error:
          "Complete the faculty name, recovery email, and teaching specialty.",
      },
      { status: 400 },
    );
  if (password.length < 12)
    return NextResponse.json(
      { error: "Faculty passwords must contain at least 12 characters." },
      { status: 400 },
    );
  if (await db.user.findUnique({ where: { email: recoveryEmail } }))
    return NextResponse.json(
      { error: "That recovery email already belongs to an account." },
      { status: 409 },
    );
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\s.-]/g, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .join(".") || "faculty";
  let academicEmail = `${base}.faculty@enfusionuniversity.edu`;
  let suffix = 2;
  while (await db.user.findFirst({ where: { academicEmail } }))
    academicEmail = `${base}.faculty${suffix++}@enfusionuniversity.edu`;
  const faculty = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name,
        email: recoveryEmail,
        academicEmail,
        passwordHash: await bcrypt.hash(password, 12),
        role: "FACULTY",
        specialty,
      },
      select: {
        id: true,
        name: true,
        email: true,
        academicEmail: true,
        specialty: true,
        suspended: true,
        createdAt: true,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: owner.id,
        action: "FACULTY_ACCOUNT_CREATED",
        entity: "User",
        entityId: created.id,
        detail: { academicEmail, specialty },
      },
    });
    return created;
  });
  return NextResponse.json({ faculty }, { status: 201 });
}

export async function PATCH(request: Request) {
  const owner = await requireOwner();
  if (!owner)
    return NextResponse.json(
      { error: "Owner access required." },
      { status: 403 },
    );

  const body = await request.json().catch(() => ({}));
  const applicationId = text(body.applicationId, 80);
  const action = text(body.action, 40);
  const note = text(body.note, 500);
  if (!applicationId)
    return NextResponse.json(
      { error: "Application is required." },
      { status: 400 },
    );

  const application = await db.studentApplication.findUnique({
    where: { id: applicationId },
    include: { user: true },
  });
  if (!application)
    return NextResponse.json(
      { error: "Application not found." },
      { status: 404 },
    );

  if (action === "set_status") {
    const status = text(body.status, 30).toUpperCase();
    if (!decisions.has(status))
      return NextResponse.json(
        { error: "Choose a valid admissions decision." },
        { status: 400 },
      );
    if (status === "ADMITTED") {
      const admitted = await finalizeAdmission(application.id, owner.id);
      await db.auditLog.create({ data: { actorId: owner.id, action: "ADMISSION_OWNER_ADMIT_OVERRIDE", entity: "StudentApplication", entityId: application.id, detail: { note } } });
      return NextResponse.json({ application: { ...application, status: "ADMITTED" }, admitted });
    }
    const updated = await db.$transaction(async (tx) => {
      const record = await tx.studentApplication.update({
        where: { id: application.id },
        data: {
          status: status as "ADMITTED" | "WAITLISTED" | "DECLINED",
          reviewedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: owner.id,
          action: "UNIVERSITY_APPLICATION_DECISION",
          entity: "StudentApplication",
          entityId: application.id,
          detail: { status, note, studentId: application.userId },
        },
      });
      return record;
    });
    return NextResponse.json({ application: updated });
  }

  if (action === "adjust_funding") {
    const amountCents = Math.round(Number(body.amountDollars) * 100);
    if (
      !Number.isSafeInteger(amountCents) ||
      amountCents === 0 ||
      Math.abs(amountCents) > MAX_ADJUSTMENT_CENTS
    ) {
      return NextResponse.json(
        { error: "Enter a non-zero adjustment no greater than $250,000." },
        { status: 400 },
      );
    }
    if (note.length < 5)
      return NextResponse.json(
        { error: "Add a reason for the funding adjustment." },
        { status: 400 },
      );
    const nextBalance = application.user.grantBalanceCents + amountCents;
    if (nextBalance < 0)
      return NextResponse.json(
        { error: "This adjustment would make the student balance negative." },
        { status: 400 },
      );

    const updated = await db.$transaction(async (tx) => {
      const student = await tx.user.update({
        where: { id: application.userId },
        data: { grantBalanceCents: { increment: amountCents } },
      });
      await tx.grantLedger.create({
        data: {
          userId: application.userId,
          type: amountCents > 0 ? "SUPPLEMENTAL_AWARD" : "ADJUSTMENT",
          amountCents,
          description: note,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: owner.id,
          action: "UNIVERSITY_FUNDING_ADJUSTED",
          entity: "User",
          entityId: application.userId,
          detail: {
            amountCents,
            previousBalanceCents: application.user.grantBalanceCents,
            nextBalanceCents: student.grantBalanceCents,
            note,
          },
        },
      });
      return student;
    });
    return NextResponse.json({ grantBalanceCents: updated.grantBalanceCents });
  }

  return NextResponse.json({ error: "Unknown owner action." }, { status: 400 });
}
