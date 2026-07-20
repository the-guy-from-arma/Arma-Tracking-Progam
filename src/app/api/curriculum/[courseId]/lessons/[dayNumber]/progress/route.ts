import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gradeKnowledgeCheck } from "@/lib/course-studio";
import type { StudioBlock } from "@/lib/curriculum-compiler";
import { text } from "@/lib/input";
import { policyGateResponse } from "@/lib/policies";
import { campusRestrictionResponse, studentAcademicRestrictionResponse } from "@/lib/campus-operations";

function record(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

export async function PATCH(request: Request, { params }: { params: Promise<{ courseId: string; dayNumber: string }> }) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (user.isStudent) { const gate = await policyGateResponse(user.id); if (gate) return gate; }
  { const gate = await campusRestrictionResponse("LEARNING_WRITE") || await studentAcademicRestrictionResponse(user.id, "LEARNING_WRITE"); if (gate) return gate; }
  const { courseId, dayNumber } = await params;
  const body = await request.json().catch(() => ({}));
  const action = text(body.action, 30) || "SAVE_DRAFT";
  const day = await db.courseDay.findFirst({ where: { courseId, dayNumber: Number(dayNumber) }, include: { activeContentVersion: true } });
  if (!day) return NextResponse.json({ error: "Course day not found." }, { status: 404 });
  const enrollment = await db.courseEnrollment.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
  if (!enrollment || enrollment.status !== "ACTIVE") return NextResponse.json({ error: "An active enrollment is required." }, { status: 409 });
  const current = await db.lessonProgress.findUnique({ where: { userId_courseDayId: { userId: user.id, courseDayId: day.id } } });
  const stepState = { ...record(current?.stepState), ...record(body.stepState) };
  const developmentNotes = text(body.developmentNotes, 8000);
  const reflection = text(body.reflection, 3000);
  const readingPosition = Math.max(0, Math.min(100, Number(body.readingPosition || 0)));
  const answerDraft = record(body.answerDraft);
  if (action !== "COMPLETE") {
    const progress = await db.lessonProgress.upsert({ where: { userId_courseDayId: { userId: user.id, courseDayId: day.id } }, update: { stepState: stepState as never, developmentNotes, reflection: reflection || current?.reflection, answerDraft: answerDraft as never, readingPosition, acknowledgedVersionId: day.activeContentVersionId }, create: { userId: user.id, courseDayId: day.id, stepState: stepState as never, developmentNotes, reflection: reflection || null, answerDraft: answerDraft as never, readingPosition, acknowledgedVersionId: day.activeContentVersionId } });
    return NextResponse.json({ saved: true, progress });
  }
  const blocks = (day.activeContentVersion?.structuredContent || []) as unknown as StudioBlock[];
  const mandatory = blocks.flatMap((block) => block.steps || []).filter((step) => step.mandatory !== false).map((step) => step.id);
  const missingSteps = mandatory.filter((id) => stepState[id] !== true);
  if (missingSteps.length) return NextResponse.json({ error: "Complete every required Workbench checkpoint before finishing this day.", missingSteps }, { status: 400 });
  if (body.labConfirmed !== true) return NextResponse.json({ error: "Confirm the practical lab result before finishing this day." }, { status: 400 });
  if (reflection.length < 25) return NextResponse.json({ error: "Add a development reflection of at least 25 characters." }, { status: 400 });
  const response = body.answer;
  const responseText = Array.isArray(response) ? response.join(" | ") : text(response, 3000);
  const grade = gradeKnowledgeCheck(day.activeContentVersion?.quizDefinition, response, day.knowledgeAnswer);
  const result = await db.$transaction(async (tx) => {
    await tx.quizAttempt.create({ data: { userId: user.id, courseDayId: day.id, answer: responseText, response: response as never, correct: grade.correct, score: grade.score, questionId: String((day.activeContentVersion?.quizDefinition as Record<string, unknown> | null)?.id || "legacy-check"), questionType: grade.type, criteriaVersion: grade.version } });
    const completedStepState = { ...stepState, __labConfirmed: true } as never;
    const progress = await tx.lessonProgress.upsert({ where: { userId_courseDayId: { userId: user.id, courseDayId: day.id } }, update: { completed: grade.correct, completedAt: grade.correct ? new Date() : null, reflection, developmentNotes, stepState: completedStepState, answerDraft: {}, readingPosition: 100, acknowledgedVersionId: day.activeContentVersionId, materiallyChangedAt: null }, create: { userId: user.id, courseDayId: day.id, completed: grade.correct, completedAt: grade.correct ? new Date() : null, reflection, developmentNotes, stepState: completedStepState, readingPosition: 100, acknowledgedVersionId: day.activeContentVersionId } });
    const [complete, total] = await Promise.all([tx.lessonProgress.count({ where: { userId: user.id, completed: true, courseDay: { courseId } } }), tx.courseDay.count({ where: { courseId } })]);
    const courseProgress = Math.round((complete / Math.max(1, total)) * 100);
    await tx.courseEnrollment.update({ where: { id: enrollment.id }, data: { progress: courseProgress } });
    await tx.auditLog.create({ data: { actorId: user.id, action: grade.correct ? "GUIDED_LESSON_COMPLETED" : "GUIDED_KNOWLEDGE_CHECK_ATTEMPTED", entity: "CourseDay", entityId: day.id, detail: { courseId, score: grade.score, contentVersionId: day.activeContentVersionId, courseProgress } } });
    return { progress, courseProgress };
  });
  return NextResponse.json({ ...result, score: grade.score, correct: grade.correct, explanation: grade.correct ? "Knowledge check passed." : "Review the procedure and source evidence, then try the check again." }, { status: grade.correct ? 200 : 422 });
}
