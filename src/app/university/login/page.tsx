import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";
export const metadata: Metadata = { title: "Enfusion University sign in" }; export const dynamic = "force-dynamic";
export default async function UniversityLogin() { const user = await currentUser(); if (user?.isStudent || ["OWNER", "ADMIN"].includes(user?.role || "")) redirect("/university"); if (user) redirect("/university/register"); return <AuthForm mode="login" portal="university"/>; }
