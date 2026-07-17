import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { adviseCourses } from "@/lib/course-advisor";
import { text } from "@/lib/input";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const answers = Array.isArray(body.answers) ? body.answers.map((item: unknown) => { const value = item as Record<string, unknown>; return { question: text(value?.question, 180), answer: text(value?.answer, 600) }; }) : [];
  if (answers.length !== 10 || answers.some((item: { question: string; answer: string }) => !item.question || !item.answer)) return NextResponse.json({ error: "Complete all 10 advising questions before requesting recommendations." }, { status: 400 });
  const result = await adviseCourses(user.id, answers);
  return NextResponse.json(result);
}
