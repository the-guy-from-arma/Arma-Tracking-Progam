import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { UniversityRegistrationForm } from "@/components/UniversityRegistrationForm";
import "@/components/UniversityRegistrationForm.css";
export const metadata: Metadata = { title: "Enfusion University admissions" }; export const dynamic = "force-dynamic";
export default async function UniversityRegister() { const user = await currentUser(); if (user?.isStudent) redirect("/university"); return <UniversityRegistrationForm existingEmail={user?.email || ""} existingName={user?.name || ""}/>; }
