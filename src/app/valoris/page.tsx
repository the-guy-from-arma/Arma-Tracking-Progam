import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RetiredValorisRoute() {
  const user = await currentUser();
  if (!user) redirect("/university/login");
  if (user.role === "FACULTY") redirect("/faculty");
  redirect("/university");
}
