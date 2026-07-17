import type { Metadata } from "next";import { redirect } from "next/navigation";import { currentUser } from "@/lib/auth";import { AuthForm } from "@/components/AuthForm";
export const metadata:Metadata={title:"Join Project VALORIS"};export const dynamic="force-dynamic";export default async function Register(){if(await currentUser())redirect("/valoris");return <AuthForm mode="register"/>}
