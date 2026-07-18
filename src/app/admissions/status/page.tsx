import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AdmissionStatusView } from "@/components/AdmissionStatusView";

export const dynamic = "force-dynamic";

export default async function AdmissionsStatusPage() {
  const user = await currentUser();
  if (!user) redirect("/university/login");
  return <AdmissionStatusView applicantName={user.name} />;
}
