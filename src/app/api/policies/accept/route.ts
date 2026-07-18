import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { policyCompliance, recordPolicyAcceptance, requestPolicyMetadata, validatePolicyBundle } from "@/lib/policies";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to accept student policies." }, { status: 401 });
  const existingCompliance = await policyCompliance(user.id);
  if (existingCompliance.compliant && existingCompliance.gateActive) {
    const existing = await db.policySignatureEvent.findFirst({ where: { userId: user.id }, orderBy: { signedAt: "desc" } });
    if (existing) return NextResponse.json({ receiptNumber: existing.receiptNumber, signatureEventId: existing.id, policyCompliant: true, receiptUrl: `/policies/receipts/${existing.id}`, idempotentReplay: true });
  }
  const body = await request.json().catch(() => ({}));
  if (body.bundleAccepted !== true) return NextResponse.json({ error: "Accept the complete listed policy bundle before signing.", code: "POLICY_BUNDLE_ACCEPTANCE_REQUIRED" }, { status: 400 });
  const validation = await validatePolicyBundle({
    policyVersionIds: Array.isArray(body.policyVersionIds) ? body.policyVersionIds.map(String) : [],
    signerName: String(body.signerName || ""),
    expectedName: user.name,
    ageAttested: body.ageAttested === true,
    electronicConsent: body.electronicConsent === true,
  });
  if (!validation.ok) return NextResponse.json({ error: validation.error, code: validation.code }, { status: validation.status });
  const metadata = requestPolicyMetadata(request);
  const event = await db.$transaction(async (tx) => {
    const receipt = await recordPolicyAcceptance({ client: tx, userId: user.id, applicantEmail: user.email, signerName: String(body.signerName), ageAttested: true, electronicConsent: true, policyVersionIds: validation.policies.map((item) => item.currentVersion.id), ...metadata });
    await tx.auditLog.create({ data: { actorId: user.id, action: "POLICY_BUNDLE_ACCEPTED", entity: "PolicySignatureEvent", entityId: receipt.id, detail: { receiptNumber: receipt.receiptNumber, versions: receipt.acceptances.map((item) => ({ slug: item.policyVersion.document.slug, version: item.policyVersion.version, checksum: item.policyVersion.checksum })) } } });
    return receipt;
  });
  const compliance = await policyCompliance(user.id);
  return NextResponse.json({ receiptNumber: event.receiptNumber, signatureEventId: event.id, policyCompliant: compliance.compliant, receiptUrl: `/policies/receipts/${event.id}` });
}
