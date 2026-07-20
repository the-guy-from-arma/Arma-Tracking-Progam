import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";
import { policyGateResponse } from "@/lib/policies";
import { campusRestrictionResponse, campusStatus, studentAcademicRestrictionResponse } from "@/lib/campus-operations";
import { getCompletedCourseIds, getProgramSequenceBlockers } from "@/lib/academic-progress";
import { gradeKnowledgeCheck } from "@/lib/course-studio";

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
  { const gate = await campusRestrictionResponse("LEARNING_WRITE") || await studentAcademicRestrictionResponse(user.id, "LEARNING_WRITE"); if (gate) return gate; }
  const { courseId } = await params; const body = await request.json().catch(() => ({}));
  const dayId = text(body.dayId, 100); const answer = text(body.answer, 1000); const reflection = text(body.reflection, 1800);
  const day = await db.courseDay.findFirst({ where: { id: dayId, courseId }, include: { activeContentVersion: true, course: { include: { prerequisites: true } } } });
  if (!day) return NextResponse.json({ error: "Course day not found." }, { status: 404 });
  const enrollment = await db.courseEnrollment.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
  if (!enrollment) return NextResponse.json({ error: "Enroll before completing lessons." }, { status: 409 });
  if (enrollment.status !== "ACTIVE") return NextResponse.json({ error: "This course is not currently active. Open Student Center for enrollment support." }, { status: 409 });
  const completedCourseIds = await getCompletedCourseIds(user.id);
  const missingPrerequisites = day.course.prerequisites.filter((item) => !completedCourseIds.has(item.prerequisiteId));
  if (missingPrerequisites.length) return NextResponse.json({ error: "Complete the required prerequisite course before beginning this curriculum.", missingPrerequisiteIds: missingPrerequisites.map((item) => item.prerequisiteId) }, { status: 409 });
  const sequenceBlockers = await getProgramSequenceBlockers(user.id, courseId, completedCourseIds);
  if (sequenceBlockers.length) return NextResponse.json({ error: `Your program keeps this course in sequence. Complete ${sequenceBlockers.join(", ")} first.`, sequenceBlockers }, { status: 409 });
  if (answer.length < 25 || reflection.length < 25) return NextResponse.json({ error: "Complete the knowledge response and development reflection." }, { status: 400 });
  const grade = gradeKnowledgeCheck(day.activeContentVersion?.quizDefinition, answer, day.knowledgeAnswer);
  const result = await db.$transaction(async (tx) => {
    await tx.quizAttempt.create({ data: { userId: user.id, courseDayId: day.id, answer, response: { answer }, correct: grade.correct, score: grade.score, questionId: String((day.activeContentVersion?.quizDefinition as Record<string, unknown> | null)?.id || "legacy-check"), questionType: grade.type, criteriaVersion: grade.version } });
    await tx.lessonProgress.upsert({ where: { userId_courseDayId: { userId: user.id, courseDayId: day.id } }, update: { completed: grade.correct, reflection, completedAt: grade.correct ? new Date() : null }, create: { userId: user.id, courseDayId: day.id, completed: grade.correct, reflection, completedAt: grade.correct ? new Date() : null } });
    const [complete, total] = await Promise.all([tx.lessonProgress.count({ where: { userId: user.id, completed: true, courseDay: { courseId } } }), tx.courseDay.count({ where: { courseId } })]);
    const progress = total ? Math.round((complete / total) * 100) : 0;
    await tx.courseEnrollment.update({ where: { id: enrollment.id }, data: { progress } });
    await tx.auditLog.create({ data: { actorId: user.id, action: grade.correct ? "COURSE_DAY_COMPLETED" : "COURSE_KNOWLEDGE_CHECK_ATTEMPTED", entity: "CourseDay", entityId: day.id, detail: { courseId, progress, score: grade.score } } });
    return { progress, complete, total, score: grade.score, correct: grade.correct };
  });
  return NextResponse.json(result, { status: grade.correct ? 200 : 422 });
}
