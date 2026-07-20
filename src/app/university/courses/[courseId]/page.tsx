import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { policyCompliance } from "@/lib/policies";
import { GuidedCourseStudio } from "@/components/GuidedCourseStudio";

export const dynamic = "force-dynamic";
export default async function CourseStudioPage({ params }: { params: Promise<{ courseId: string }> }) {
  const user = await currentUser(); if (!user) redirect("/university/login");
  if (user.isStudent) { const compliance = await policyCompliance(user.id); if (!compliance.compliant) redirect("/policies/accept"); }
  const { courseId } = await params;
  return <GuidedCourseStudio courseId={courseId} />;
}
