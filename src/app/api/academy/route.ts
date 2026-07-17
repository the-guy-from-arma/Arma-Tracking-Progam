import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";

const courseLevels = new Set(["FOUNDATION", "INTERMEDIATE", "ADVANCED", "CAPSTONE"]);
const studios = new Set(["Thunder Buddies Studios", "Black Ridge Studios", "Thunder Buddies Studios + Black Ridge Studios"]);

function positiveCredits(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 12 ? parsed : 3;
}

function serviceValueCents(value: unknown) {
  const dollars = Number(value);
  return Number.isFinite(dollars) && dollars >= 500 && dollars <= 50000 ? Math.round(dollars * 100) : 450000;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const admin = isAdmin(user.role);
  const [courses, submissions, certificates, programs, grantLedger] = await Promise.all([
    db.course.findMany({
      where: admin ? {} : { status: "PUBLISHED" },
      include: { enrollments: { where: { userId: user.id } }, _count: { select: { enrollments: true, submissions: true } } },
      orderBy: [{ level: "asc" }, { code: "asc" }],
    }),
    db.courseSubmission.findMany({
      where: admin ? {} : { studentId: user.id },
      include: {
        course: { select: { code: true, title: true, studio: true, learningCredits: true } },
        student: { select: { id: true, name: true, email: true } },
        reviewer: { select: { name: true } },
        certificate: true,
      },
      orderBy: { submittedAt: "desc" },
    }),
    db.certificate.findMany({ where: { userId: user.id }, include: { course: { select: { code: true, title: true, studio: true } } }, orderBy: { issuedAt: "desc" } }),
    db.academicProgram.findMany({ where: { active: true }, include: { enrollments: { where: { userId: user.id } } }, orderBy: { creditsRequired: "asc" } }),
    db.grantLedger.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  const learningCredits = certificates.reduce((total, certificate) => total + certificate.learningCredits, 0);
  return NextResponse.json({ courses, submissions, certificates, programs, grantLedger, grantBalanceCents: user.grantBalanceCents, learningCredits, canReview: admin, viewerId: user.id });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "create_course") {
    if (!isAdmin(user.role)) return NextResponse.json({ error: "Studio authoring authority required" }, { status: 403 });
    const code = text(body.code, 20).toUpperCase();
    const title = text(body.title, 100);
    const summary = text(body.summary, 800);
    const deliverable = text(body.deliverable, 800);
    const studio = text(body.studio, 100);
    const level = String(body.level || "");
    if (code.length < 3 || title.length < 3 || summary.length < 20 || deliverable.length < 20 || !studios.has(studio) || !courseLevels.has(level)) {
      return NextResponse.json({ error: "Complete the studio, course code, level, summary, and assessed deliverable." }, { status: 400 });
    }
    const course = await db.course.create({ data: { code, title, summary, deliverable, studio, level: level as never, status: "PUBLISHED", learningCredits: positiveCredits(body.learningCredits), serviceValueCents: serviceValueCents(body.serviceValue), createdById: user.id } }).catch(() => null);
    if (!course) return NextResponse.json({ error: "That course code is already in use." }, { status: 409 });
    await db.auditLog.create({ data: { actorId: user.id, action: "COURSE_PUBLISHED", entity: "Course", entityId: course.id, detail: { code, studio } } });
    return NextResponse.json({ course }, { status: 201 });
  }

  if (action === "enroll_course") {
    if (!user.isStudent && !isAdmin(user.role)) return NextResponse.json({ error: "Activate an Enfusion University student identity before enrolling." }, { status: 403 });
    const courseId = text(body.courseId, 100);
    const course = await db.course.findFirst({ where: { id: courseId, status: "PUBLISHED" }, include: { prerequisites: true } });
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    const existing = await db.courseEnrollment.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
    if (existing) return NextResponse.json({ enrollment: existing, grantBalanceCents: user.grantBalanceCents, allocatedCents: 0 });
    if (course.prerequisites.length) {
      const completed = await db.courseEnrollment.count({ where: { userId: user.id, status: "COMPLETED", courseId: { in: course.prerequisites.map((item) => item.prerequisiteId) } } });
      if (completed !== course.prerequisites.length) return NextResponse.json({ error: "Complete the listed prerequisite course before enrolling." }, { status: 409 });
    }
    const result = await db.$transaction(async (tx) => {
      const current = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { grantBalanceCents: true } });
      let available = current.grantBalanceCents;
      if (available < course.serviceValueCents) {
        const supplemental = Math.max(2_500_000, course.serviceValueCents - available);
        available += supplemental;
        await tx.grantLedger.create({ data: { userId: user.id, type: "SUPPLEMENTAL_AWARD", amountCents: supplemental, description: "Automatic Thunder Buddies Studios continuing-study award" } });
      }
      const grantBalanceCents = available - course.serviceValueCents;
      const enrollment = await tx.courseEnrollment.create({ data: { courseId, userId: user.id } });
      await tx.user.update({ where: { id: user.id }, data: { grantBalanceCents } });
      await tx.grantLedger.create({ data: { userId: user.id, type: "COURSE_ALLOCATION", amountCents: -course.serviceValueCents, description: `${course.code} ${course.title} sponsored service allocation`, courseId } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "COURSE_ENROLLED", entity: "Course", entityId: courseId, detail: { serviceValueCents: course.serviceValueCents, studentDueCents: 0, grantBalanceCents } } });
      return { enrollment, grantBalanceCents };
    });
    return NextResponse.json({ ...result, allocatedCents: course.serviceValueCents, studentDueCents: 0 });
  }

  if (action === "submit_mod") {
    const courseId = text(body.courseId, 100);
    const title = text(body.title, 120);
    const summary = text(body.summary, 1400);
    const referenceUrl = text(body.referenceUrl, 300);
    const demoUrl = text(body.demoUrl, 300);
    if (title.length < 3 || summary.length < 30 || (referenceUrl && !/^https?:\/\//i.test(referenceUrl))) return NextResponse.json({ error: "Add a title, detailed project brief, and a valid optional reference URL." }, { status: 400 });
    const enrollment = await db.courseEnrollment.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
    if (!enrollment || enrollment.status === "WITHDRAWN") return NextResponse.json({ error: "Enroll in the course before submitting a mod." }, { status: 409 });
    const existing = await db.courseSubmission.findUnique({ where: { courseId_studentId: { courseId, studentId: user.id } } });
    if (existing && ["SUBMITTED", "IN_REVIEW", "APPROVED"].includes(existing.status)) return NextResponse.json({ error: "This course already has an active or approved submission." }, { status: 409 });
    const submission = await db.courseSubmission.upsert({
      where: { courseId_studentId: { courseId, studentId: user.id } },
      update: { title, summary, referenceUrl: referenceUrl || null, demoUrl: demoUrl || null, status: "SUBMITTED", feedback: null, reviewerId: null, reviewedAt: null, submittedAt: new Date() },
      create: { courseId, studentId: user.id, title, summary, referenceUrl: referenceUrl || null, demoUrl: demoUrl || null },
    });
    await db.courseEnrollment.update({ where: { id: enrollment.id }, data: { progress: 100 } });
    await db.auditLog.create({ data: { actorId: user.id, action: "MOD_SUBMITTED", entity: "CourseSubmission", entityId: submission.id, detail: { courseId, title } } });
    return NextResponse.json({ submission }, { status: 201 });
  }

  if (action === "enroll_program") {
    const programId = text(body.programId, 100);
    const program = await db.academicProgram.findFirst({ where: { id: programId, active: true } });
    if (!program) return NextResponse.json({ error: "Academic path not found" }, { status: 404 });
    const creditSum = await db.certificate.aggregate({ where: { userId: user.id }, _sum: { learningCredits: true } });
    const creditsEarned = creditSum._sum.learningCredits || 0;
    const enrollment = await db.programEnrollment.upsert({ where: { programId_userId: { programId, userId: user.id } }, update: { status: "ACTIVE", creditsEarned }, create: { programId, userId: user.id, creditsEarned } });
    return NextResponse.json({ enrollment });
  }

  return NextResponse.json({ error: "Unknown academy action" }, { status: 400 });
}
