import type { Metadata } from "next";import { redirect } from "next/navigation";import { currentUser } from "@/lib/auth";import { AuthForm } from "@/components/AuthForm";
export const metadata:Metadata={title:"Sign in"};export const dynamic="force-dynamic";export default async function Login(){if(await currentUser())redirect("/");return <AuthForm mode="login"/>}
