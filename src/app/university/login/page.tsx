import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { UniversitySignIn } from "@/components/UniversitySignIn";

export const metadata: Metadata = {
  title: "Student sign in | Enscript University",
  description: "Secure access to the Enscript University student campus.",
};

export const dynamic = "force-dynamic";

export default async function UniversityLogin() {
  const user = await currentUser();
  if (user?.isStudent || ["OWNER", "ADMIN"].includes(user?.role || "")) {
    redirect("/university");
  }
  if (user) redirect("/university/register");
  return <UniversitySignIn />;
}
