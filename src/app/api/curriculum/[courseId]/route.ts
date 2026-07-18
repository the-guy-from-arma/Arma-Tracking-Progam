import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";
import { policyGateResponse } from "@/lib/policies";
import { campusRestrictionResponse, campusStatus } from "@/lib/campus-operations";

export async function GET(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (user.isStudent) { const gate = await policyGateResponse(user.id); if (gate) return gate; }
  { const gate = await campusRestrictionResponse("LEARNING_READ"); if (gate) return gate; }
  const { courseId } = await params;
  const course = await db.course.findUnique({ where: { id: courseId }, include: { days: { include: { progress: { where: { userId: user.id } } }, orderBy: { dayNumber: "asc" } }, sourceMappings: { include: { source: true } }, prerequisites: { include: { prerequisite: { select: { id: true, code: true, title: true } } } }, enrollments: { where: { userId: user.id } } } });
  if (!course || (course.status !== "PUBLISHED" && !["ADMIN", "OWNER"].includes(user.role) && course.enrollments.length === 0)) return NextResponse.json({ error: "Course not found." }, { status: 404 });
  return NextResponse.json({ course: { ...course, sources: course.sourceMappings.map((mapping) => mapping.source), sourceMappings: undefined }, operations: await campusStatus() });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (user.isStudent) { const gate = await policyGateResponse(user.id); if (gate) return gate; }
  { const gate = await campusRestrictionResponse("LEARNING_WRITE"); if (gate) return gate; }
  const { courseId } = await params; const body = await request.json().catch(() => ({}));
  const dayId = text(body.dayId, 100); const answer = text(body.answer, 1000); const reflection = text(body.reflection, 1800);
  const day = await db.courseDay.findFirst({ where: { id: dayId, courseId } });
  if (!day) return NextResponse.json({ error: "Course day not found." }, { status: 404 });
  const enrollment = await db.courseEnrollment.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
  if (!enrollment) return NextResponse.json({ error: "Enroll before completing lessons." }, { status: 409 });
  if (answer.length < 25 || reflection.length < 25) return NextResponse.json({ error: "Complete the knowledge response and development reflection." }, { status: 400 });
  const result = await db.$transaction(async (tx) => {
    await tx.quizAttempt.create({ data: { userId: user.id, courseDayId: day.id, answer, correct: true, score: 100 } });
    await tx.lessonProgress.upsert({ where: { userId_courseDayId: { userId: user.id, courseDayId: day.id } }, update: { completed: true, reflection, completedAt: new Date() }, create: { userId: user.id, courseDayId: day.id, completed: true, reflection, completedAt: new Date() } });
    const [complete, total] = await Promise.all([tx.lessonProgress.count({ where: { userId: user.id, completed: true, courseDay: { courseId } } }), tx.courseDay.count({ where: { courseId } })]);
    const progress = total ? Math.round((complete / total) * 100) : 0;
    await tx.courseEnrollment.update({ where: { id: enrollment.id }, data: { progress } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "COURSE_DAY_COMPLETED", entity: "CourseDay", entityId: day.id, detail: { courseId, progress } } });
    return { progress, complete, total };
  });
  return NextResponse.json(result);
}
