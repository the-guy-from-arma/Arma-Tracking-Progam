import { redirect } from "next/navigation";
import { currentUser, isAdmin } from "@/lib/auth";
import { UniversityPortal } from "@/components/UniversityPortal";
import { policyCompliance } from "@/lib/policies";

export const dynamic = "force-dynamic";
export default async function UniversityPage() { const user = await currentUser(); if (!user) redirect("/university/login"); if (!user.isStudent && !isAdmin(user.role)) redirect("/university/register"); if(user.isStudent){const compliance=await policyCompliance(user.id);if(!compliance.compliant)redirect("/policies/accept");} return <UniversityPortal user={{ name: user.name, role: user.role, academicEmail: user.academicEmail, studentNumber: user.studentNumber }}/>; }
