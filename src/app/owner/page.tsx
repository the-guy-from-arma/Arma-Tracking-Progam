import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { OwnerConsole } from "@/components/OwnerConsole";

export const dynamic = "force-dynamic";

export default async function OwnerPage() {
  const user = await currentUser();
  if (!user || user.role !== "OWNER") redirect("/owner/login");
  return <OwnerConsole ownerName={user.name} />;
}
