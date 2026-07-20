import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { UniversityRegistrationForm } from "@/components/UniversityRegistrationForm";
import { db } from "@/lib/db";
import "@/components/UniversityRegistrationForm.css";
import "@/components/UniversityRegistrationReliability.css";
export const metadata: Metadata = { title: "Enscript University admissions" };
export const dynamic = "force-dynamic";
export default async function UniversityRegister() {
  const user = await currentUser();
  if (user?.isStudent) redirect("/university");
  if (user && await db.studentApplication.findUnique({ where: { userId: user.id }, select: { id: true } })) redirect("/admissions/status");
  return (
    <UniversityRegistrationForm
      existingEmail={user?.email || ""}
      existingName={user?.name || ""}
    />
  );
}
