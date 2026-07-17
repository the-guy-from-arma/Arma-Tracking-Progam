import type { Metadata } from "next";import { redirect } from "next/navigation";import { currentUser } from "@/lib/auth";import { AuthForm } from "@/components/AuthForm";
export const metadata:Metadata={title:"Project VALORIS sign in"};export const dynamic="force-dynamic";export default async function Login(){if(await currentUser())redirect("/valoris");return <AuthForm mode="login"/>}
