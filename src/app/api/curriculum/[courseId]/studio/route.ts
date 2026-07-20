import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getCourseStudio } from "@/lib/course-studio";
import { policyGateResponse } from "@/lib/policies";
import { campusRestrictionResponse } from "@/lib/campus-operations";

export async function GET(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (user.isStudent) { const gate = await policyGateResponse(user.id); if (gate) return gate; }
  { const gate = await campusRestrictionResponse("LEARNING_READ"); if (gate) return gate; }
  const { courseId } = await params;
  const course = await getCourseStudio(courseId, user.id);
  if (!course) return NextResponse.json({ error: "Course studio not found." }, { status: 404 });
  return NextResponse.json({ course });
}
