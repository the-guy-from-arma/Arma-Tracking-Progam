import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Owner Administration Sign In" };
export const dynamic = "force-dynamic";

export default async function OwnerLoginPage() {
  const user = await currentUser();
  if (user?.role === "OWNER") redirect("/owner");
  return <AuthForm mode="login" portal="owner" />;
}
