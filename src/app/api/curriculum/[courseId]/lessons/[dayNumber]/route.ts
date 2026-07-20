import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getCourseStudio } from "@/lib/course-studio";
import { policyGateResponse } from "@/lib/policies";
import { campusRestrictionResponse } from "@/lib/campus-operations";

export async function GET(_: Request, { params }: { params: Promise<{ courseId: string; dayNumber: string }> }) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (user.isStudent) { const gate = await policyGateResponse(user.id); if (gate) return gate; }
  { const gate = await campusRestrictionResponse("LEARNING_READ"); if (gate) return gate; }
  const { courseId, dayNumber } = await params;
  const course = await getCourseStudio(courseId, user.id);
  const day = course?.days.find((item) => item.dayNumber === Number(dayNumber));
  if (!course || !day || (!course.enrollment && !["ADMIN", "OWNER", "FACULTY"].includes(user.role))) return NextResponse.json({ error: "Lesson not found or enrollment required." }, { status: 404 });
  return NextResponse.json({ course: { id: course.id, code: course.code, title: course.title, academy: course.academy, days: course.days.map((item) => ({ id: item.id, dayNumber: item.dayNumber, title: item.title, completed: Boolean(item.progress?.completed) })) }, lesson: day });
}
