import crypto from "node:crypto";
import { db } from "@/lib/db";
import { trackingEvent } from "@/lib/application-tracking";
import { hashPolicyIp } from "@/lib/policies";

const TOKEN_DAYS = 14;
const STRIPE_API = "https://api.stripe.com/v1";

function requiredSecret(name: string) {
  const value = String(process.env[name] || "").trim();
  if (value.length < 32) throw new Error(`${name} must contain at least 32 characters.`);
  return value;
}

export function createGuardianAccessToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  return {
    token,
    accessTokenHash: hashGuardianAccessToken(token),
    tokenExpiresAt: new Date(Date.now() + TOKEN_DAYS * 86_400_000),
  };
}

export function hashGuardianAccessToken(token: string) {
  return crypto
    .createHmac("sha256", requiredSecret("GUARDIAN_CONSENT_TOKEN_SECRET"))
    .update(token)
    .digest("hex");
}

export function exactAge(dateOfBirth: Date, on = new Date()) {
  let age = on.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (on.getUTCMonth() === dateOfBirth.getUTCMonth() &&
      on.getUTCDate() < dateOfBirth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function parseDateOfBirth(value: unknown) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw)
    return null;
  return date;
}

export function normalizePersonName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function namesMatch(expected: string, firstName: unknown, lastName: unknown) {
  const expectedParts = new Set(normalizePersonName(expected).split(" ").filter(Boolean));
  const verifiedParts = normalizePersonName(`${String(firstName || "")} ${String(lastName || "")}`)
    .split(" ")
    .filter(Boolean);
  return verifiedParts.length >= 2 && verifiedParts.every((part) => expectedParts.has(part));
}

async function stripeRequest(path: string, init: RequestInit = {}) {
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) throw new Error("Guardian identity verification is not configured.");
  const response = await fetch(`${STRIPE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(init.body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const error = payload.error as { message?: string; code?: string } | undefined;
    throw new Error(error?.code || error?.message || "Identity provider request failed.");
  }
  return payload;
}

export async function createStripeIdentitySession(input: {
  consentId: string;
  guardianEmail: string;
  returnUrl: string;
}) {
  const params = new URLSearchParams();
  params.set("type", "document");
  params.set("client_reference_id", input.consentId);
  params.set("metadata[guardian_consent_id]", input.consentId);
  params.set("provided_details[email]", input.guardianEmail);
  params.set("return_url", input.returnUrl);
  params.set("options[document][require_live_capture]", "true");
  params.set("options[document][require_matching_selfie]", "true");
  return stripeRequest("/identity/verification_sessions", {
    method: "POST",
    body: params,
  });
}

async function retrieveStripeIdentitySession(sessionId: string) {
  const params = new URLSearchParams();
  params.append("expand[]", "verified_outputs");
  return stripeRequest(`/identity/verification_sessions/${encodeURIComponent(sessionId)}?${params}`);
}

async function redactStripeIdentitySession(sessionId: string) {
  await stripeRequest(
    `/identity/verification_sessions/${encodeURIComponent(sessionId)}/redact`,
    { method: "POST", body: new URLSearchParams() },
  );
}

export function verifyStripeWebhook(rawBody: string, signatureHeader: string | null) {
  const secret = requiredSecret("STRIPE_IDENTITY_WEBHOOK_SECRET");
  const parts = String(signatureHeader || "").split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return signatures.some((signature) => {
    if (signature.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  });
}

function safeFailureCode(value: unknown) {
  return String(value || "verification_requires_input")
    .replace(/[^a-zA-Z0-9_.-]/g, "_")
    .slice(0, 100);
}

export async function handleStripeIdentityEvent(event: Record<string, unknown>) {
  const type = String(event.type || "");
  const data = event.data as { object?: Record<string, unknown> } | undefined;
  const object = data?.object || {};
  const sessionId = String(object.id || "");
  const metadata = (object.metadata || {}) as Record<string, unknown>;
  const consentId = String(metadata.guardian_consent_id || object.client_reference_id || "");
  const consent = await db.guardianConsent.findFirst({
    where: { OR: [{ id: consentId || "missing" }, { providerSessionId: sessionId || "missing" }] },
    include: { application: { include: { trackingRecords: { orderBy: { createdAt: "desc" }, take: 1 } } } },
  });
  if (!consent) return { handled: false, reason: "unknown_session" };
  if (consent.providerSessionId && sessionId && consent.providerSessionId !== sessionId)
    return { handled: false, reason: "superseded_session" };
  if (type === "identity.verification_session.verified" && consent.status === "VERIFIED" && consent.verifiedAt)
    return { handled: true, status: "VERIFIED", idempotentReplay: true };

  if (type === "identity.verification_session.processing") {
    await db.guardianConsent.update({ where: { id: consent.id }, data: { status: "PROCESSING", providerStatus: "processing", providerFailureCode: null } });
    return { handled: true, status: "PROCESSING" };
  }
  if (type === "identity.verification_session.requires_input") {
    const lastError = object.last_error as { code?: string } | undefined;
    await db.guardianConsent.update({ where: { id: consent.id }, data: { status: "REQUIRES_INPUT", providerStatus: "requires_input", providerFailureCode: safeFailureCode(lastError?.code) } });
    return { handled: true, status: "REQUIRES_INPUT" };
  }
  if (type === "identity.verification_session.canceled" || type === "identity.verification_session.redacted") {
    await db.guardianConsent.update({ where: { id: consent.id }, data: { status: type.endsWith("redacted") && consent.verifiedAt ? "VERIFIED" : "REQUIRES_INPUT", providerStatus: type.split(".").at(-1), providerFailureCode: type.endsWith("canceled") ? "session_canceled" : consent.providerFailureCode } });
    return { handled: true, status: type.split(".").at(-1) };
  }
  if (type !== "identity.verification_session.verified")
    return { handled: false, reason: "ignored_event" };

  const session = await retrieveStripeIdentitySession(sessionId);
  const outputs = (session.verified_outputs || {}) as Record<string, unknown>;
  const dob = outputs.dob as { day?: number; month?: number; year?: number } | undefined;
  const dateOfBirth = dob?.year && dob?.month && dob?.day
    ? new Date(Date.UTC(dob.year, dob.month - 1, dob.day))
    : null;
  const adultVerified = Boolean(dateOfBirth && exactAge(dateOfBirth) >= 18);
  const nameMatched = namesMatch(consent.guardianName, outputs.first_name, outputs.last_name);
  const country = String((outputs.address as { country?: string } | undefined)?.country || "").slice(0, 2) || null;
  const verified = adultVerified && nameMatched;
  const tracker = consent.application.trackingRecords[0];

  await db.$transaction(async (tx) => {
    await tx.guardianConsent.update({
      where: { id: consent.id },
      data: {
        status: verified ? "VERIFIED" : "REQUIRES_INPUT",
        providerStatus: "verified",
        providerFailureCode: verified ? null : !adultVerified ? "guardian_not_adult" : "guardian_name_mismatch",
        adultVerified,
        nameMatched,
        verifiedAt: verified ? new Date() : null,
        verificationCountry: country,
      },
    });
    if (verified) {
      await tx.studentApplication.update({ where: { id: consent.applicationId }, data: { status: "UNDER_AUTOMATED_REVIEW" } });
      await tx.admissionReviewJob.updateMany({
        where: { applicationId: consent.applicationId, status: "WAITING_FOR_GUARDIAN" },
        data: { status: "QUEUED", stage: "IDENTITY_ELIGIBILITY", availableAt: new Date(), lockedAt: null, heartbeatAt: null, lastError: null },
      });
      if (tracker) {
        const history = Array.isArray(tracker.statusHistory) ? tracker.statusHistory : [];
        await tx.applicationTracking.update({
          where: { id: tracker.id },
          data: { statusHistory: [...history, trackingEvent("GUARDIAN_VERIFIED", "Parent or guardian consent and adult identity verification completed")] },
        });
      }
      await tx.auditLog.create({
        data: { action: "GUARDIAN_CONSENT_VERIFIED", entity: "GuardianConsent", entityId: consent.id, detail: { provider: "STRIPE_IDENTITY", adultVerified, nameMatched, providerSessionId: sessionId } },
      });
    }
  });
  if (verified) await redactStripeIdentitySession(sessionId).catch(() => undefined);
  return { handled: true, status: verified ? "VERIFIED" : "REQUIRES_INPUT" };
}

export function guardianRequestMetadata(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    userAgent: (request.headers.get("user-agent") || "unknown").slice(0, 500),
    ipHash: hashPolicyIp(forwarded || request.headers.get("x-real-ip") || "unknown"),
  };
}
