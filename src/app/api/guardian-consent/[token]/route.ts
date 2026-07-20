import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { text } from "@/lib/input";
import {
  createStripeIdentitySession,
  guardianRequestMetadata,
  hashGuardianAccessToken,
  normalizePersonName,
} from "@/lib/guardian-verification";

export const runtime = "nodejs";
export const maxDuration = 60;

async function consentForToken(token: string) {
  if (token.length < 32) return null;
  const consent = await db.guardianConsent.findUnique({
    where: { accessTokenHash: hashGuardianAccessToken(token) },
    include: { application: { include: { user: { select: { name: true } } } } },
  });
  if (!consent) return null;
  if (consent.tokenExpiresAt.getTime() < Date.now() && consent.status !== "VERIFIED") {
    await db.guardianConsent.update({ where: { id: consent.id }, data: { status: "EXPIRED" } });
    return { ...consent, status: "EXPIRED" as const };
  }
  return consent;
}

function publicConsent(consent: NonNullable<Awaited<ReturnType<typeof consentForToken>>>) {
  return {
    applicantName: consent.application.user.name,
    guardianName: consent.guardianName,
    guardianEmail: consent.guardianEmail.replace(/^(.{1,2}).*(@.*)$/, "$1••••$2"),
    relationship: consent.relationship,
    status: consent.status,
    expiresAt: consent.tokenExpiresAt,
    verifiedAt: consent.verifiedAt,
    failureCode: consent.providerFailureCode,
    alternativeRequestedAt: consent.alternativeRequestedAt,
  };
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const consent = await consentForToken(token);
  if (!consent) return NextResponse.json({ error: "This guardian invitation is invalid or has been replaced." }, { status: 404 });
  return NextResponse.json({ consent: publicConsent(consent) });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const consent = await consentForToken(token);
  if (!consent) return NextResponse.json({ error: "This guardian invitation is invalid or has been replaced." }, { status: 404 });
  if (consent.status === "EXPIRED") return NextResponse.json({ error: "This invitation expired. Ask the applicant to create a new invitation from the tracking page." }, { status: 410 });
  if (consent.status === "VERIFIED") return NextResponse.json({ consent: publicConsent(consent) });
  const body = await request.json().catch(() => ({}));
  const action = text(body.action, 40);
  if (action === "request_alternative") {
    const reason = text(body.reason, 600);
    if (reason.length < 10) return NextResponse.json({ error: "Briefly explain why another verification route is needed." }, { status: 400 });
    const signerName = text(body.signerName, 100);
    if (normalizePersonName(signerName) !== normalizePersonName(consent.guardianName)) return NextResponse.json({ error: "The typed signature must match the parent or guardian legal name on the invitation." }, { status: 400 });
    if (body.parentalResponsibilityAttested !== true || body.studentParticipationAuthorized !== true || body.privacyAcknowledged !== true) return NextResponse.json({ error: "Complete all three guardian consent statements before requesting alternative identity review." }, { status: 400 });
    const metadata = guardianRequestMetadata(request);
    const updated = await db.$transaction(async (tx) => {
      const record = await tx.guardianConsent.update({ where: { id: consent.id }, data: { status: "ALTERNATIVE_REVIEW", verificationMethod: "ALTERNATIVE_REVIEW", alternativeRequestedAt: new Date(), alternativeReason: reason, consentedName: signerName, parentalResponsibilityAttested: true, studentParticipationAuthorized: true, privacyAcknowledged: true, consentedAt: new Date(), ...metadata } });
      await tx.auditLog.create({ data: { action: "GUARDIAN_ALTERNATIVE_VERIFICATION_REQUESTED", entity: "GuardianConsent", entityId: consent.id, detail: { reason } } });
      return record;
    });
    return NextResponse.json({ consent: { ...publicConsent(consent), status: updated.status, alternativeRequestedAt: updated.alternativeRequestedAt } });
  }
  if (action !== "begin_verification") return NextResponse.json({ error: "Choose a valid guardian action." }, { status: 400 });
  if (process.env.GUARDIAN_VERIFICATION_ENABLED !== "true")
    return NextResponse.json({ error: "Hosted identity verification is temporarily unavailable. Request the alternative verification route below." }, { status: 503 });
  const signerName = text(body.signerName, 100);
  if (normalizePersonName(signerName) !== normalizePersonName(consent.guardianName))
    return NextResponse.json({ error: "The typed signature must match the parent or guardian legal name on the invitation." }, { status: 400 });
  if (body.parentalResponsibilityAttested !== true || body.studentParticipationAuthorized !== true || body.privacyAcknowledged !== true)
    return NextResponse.json({ error: "Complete all three guardian consent statements before identity verification." }, { status: 400 });
  const metadata = guardianRequestMetadata(request);
  const origin = new URL(request.url).origin;
  const session = await createStripeIdentitySession({
    consentId: consent.id,
    guardianEmail: consent.guardianEmail,
    returnUrl: `${origin}/guardian-consent/${token}?verification=returned`,
  });
  const sessionId = String(session.id || "");
  const redirectUrl = String(session.url || "");
  if (!sessionId || !redirectUrl) return NextResponse.json({ error: "The identity provider did not create a usable session." }, { status: 502 });
  await db.$transaction([
    db.guardianConsent.update({
      where: { id: consent.id },
      data: { status: "IDENTITY_PENDING", verificationMethod: "STRIPE_IDENTITY", consentedName: signerName, parentalResponsibilityAttested: true, studentParticipationAuthorized: true, privacyAcknowledged: true, consentedAt: new Date(), provider: "STRIPE_IDENTITY", providerSessionId: sessionId, providerStatus: String(session.status || "requires_input"), providerFailureCode: null, ...metadata },
    }),
    db.auditLog.create({ data: { action: "GUARDIAN_CONSENT_SIGNED", entity: "GuardianConsent", entityId: consent.id, detail: { provider: "STRIPE_IDENTITY", providerSessionId: sessionId } } }),
  ]);
  return NextResponse.json({ redirectUrl });
}
