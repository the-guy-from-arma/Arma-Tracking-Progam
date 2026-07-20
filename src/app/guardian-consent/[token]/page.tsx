import { GuardianConsentView } from "@/components/GuardianConsentView";

export default async function GuardianConsentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <GuardianConsentView token={token} />;
}
