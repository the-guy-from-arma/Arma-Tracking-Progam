import crypto from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "./db";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const POLICY_SETTING_ID = "institution-policy";

export function policyChecksum(content: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

export function hashPolicyIp(value: string) {
  const salt = process.env.POLICY_IP_SALT || process.env.SESSION_SECRET || "development-policy-salt";
  return crypto.createHmac("sha256", salt).update(value || "unknown").digest("hex");
}

export function requestPolicyMetadata(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    userAgent: (request.headers.get("user-agent") || "unknown").slice(0, 500),
    ipHash: hashPolicyIp(forwarded || request.headers.get("x-real-ip") || "unknown"),
  };
}

export function createReceiptNumber() {
  return `EFU-SIG-${new Date().getUTCFullYear()}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
}

export async function getPolicySetting(client: DbClient = db) {
  return client.institutionPolicySetting.upsert({
    where: { id: POLICY_SETTING_ID },
    update: {},
    create: { id: POLICY_SETTING_ID },
  });
}

export async function currentPublishedPolicies(client: DbClient = db) {
  const now = new Date();
  const documents = await client.policyDocument.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      versions: {
        where: { status: "PUBLISHED", effectiveAt: { lte: now } },
        orderBy: { version: "desc" },
      },
    },
  });
  return documents.flatMap((document) => {
    const version = document.versions[0];
    return version ? [{ ...document, currentVersion: version }] : [];
  });
}

export async function policyCompliance(userId: string, client: DbClient = db) {
  const [setting, policies] = await Promise.all([
    getPolicySetting(client),
    currentPublishedPolicies(client),
  ]);
  if (!setting.gateActive || policies.length === 0) {
    return { compliant: true, gateActive: false, missing: [], policies };
  }
  const materialVersions = await client.policyVersion.findMany({
    where: { documentId: { in: policies.map((item) => item.id) }, status: "PUBLISHED", materialChange: true, effectiveAt: { lte: new Date() } },
    orderBy: [{ documentId: "asc" }, { version: "desc" }],
  });
  const latestMaterial = new Map<string, (typeof materialVersions)[number]>();
  for (const version of materialVersions) if (!latestMaterial.has(version.documentId)) latestMaterial.set(version.documentId, version);
  const required = policies.filter((item) => item.mandatory && latestMaterial.has(item.id)).map((item) => ({ ...item, currentVersion: latestMaterial.get(item.id)! }));
  const accepted = await client.policyAcceptance.findMany({
    where: { userId, policyVersionId: { in: required.map((item) => item.currentVersion.id) } },
    select: { policyVersionId: true },
  });
  const acceptedIds = new Set(accepted.map((item) => item.policyVersionId));
  const missing = required.filter((item) => !acceptedIds.has(item.currentVersion.id));
  return { compliant: missing.length === 0, gateActive: true, missing, policies };
}

export async function policyGateResponse(userId: string) {
  const compliance = await policyCompliance(userId);
  if (compliance.compliant) return null;
  return NextResponse.json(
    {
      error: "Review and electronically sign the current university policy bundle to continue.",
      code: "POLICY_ACCEPTANCE_REQUIRED",
      policyCompliant: false,
      missingPolicyVersions: compliance.missing.map((item) => ({
        id: item.currentVersion.id,
        slug: item.slug,
        title: item.title,
        version: item.currentVersion.version,
      })),
      policyGateUrl: "/policies/accept",
    },
    { status: 428 },
  );
}

export async function validatePolicyBundle(input: {
  policyVersionIds: string[];
  signerName: string;
  expectedName: string;
  ageAttested: boolean;
  electronicConsent: boolean;
}) {
  const setting = await getPolicySetting();
  const policies = await currentPublishedPolicies();
  if (!setting.gateActive || policies.length === 0) {
    return { ok: false as const, status: 503, code: "POLICIES_NOT_PUBLISHED", error: "Admissions are awaiting publication of the legally reviewed policy bundle." };
  }
  const required = policies.filter((item) => item.mandatory);
  const expected = required.map((item) => item.currentVersion.id).sort();
  const received = [...new Set(input.policyVersionIds)].sort();
  if (expected.length !== received.length || expected.some((id, index) => id !== received[index])) {
    return { ok: false as const, status: 409, code: "POLICY_VERSION_CHANGED", error: "A policy changed while you were reviewing it. Review the current versions before signing." };
  }
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  if (!input.ageAttested) return { ok: false as const, status: 400, code: "AGE_ATTESTATION_REQUIRED", error: "You must attest to your age eligibility and the accuracy of your application." };
  if (!input.electronicConsent) return { ok: false as const, status: 400, code: "ELECTRONIC_CONSENT_REQUIRED", error: "Electronic-record and signature consent is required for this online-only institution." };
  if (normalize(input.signerName) !== normalize(input.expectedName)) return { ok: false as const, status: 400, code: "SIGNATURE_NAME_MISMATCH", error: "Your typed signature must match the name on the application." };
  return { ok: true as const, policies: required };
}

export async function recordPolicyAcceptance(input: {
  client?: DbClient;
  userId: string;
  applicantEmail?: string;
  signerName: string;
  ageAttested: boolean;
  electronicConsent: boolean;
  policyVersionIds: string[];
  userAgent: string;
  ipHash: string;
}) {
  const client = input.client || db;
  const event = await client.policySignatureEvent.create({
    data: {
      receiptNumber: createReceiptNumber(),
      userId: input.userId,
      applicantEmail: input.applicantEmail,
      signerName: input.signerName,
      ageAttested: input.ageAttested,
      electronicConsent: input.electronicConsent,
      userAgent: input.userAgent,
      ipHash: input.ipHash,
      acceptances: {
        create: input.policyVersionIds.map((policyVersionId) => ({ userId: input.userId, policyVersionId })),
      },
    },
    include: { acceptances: { include: { policyVersion: { include: { document: true } } } } },
  });
  await client.aiGradeJob.updateMany({
    where: { submission: { studentId: input.userId }, status: "WAITING_FOR_CONSENT" },
    data: { status: "QUEUED", availableAt: new Date(), lastError: null },
  });
  await client.facultyReplyJob.updateMany({
    where: { conversation: { studentId: input.userId }, status: "WAITING_FOR_CONSENT" },
    data: { status: "QUEUED", availableAt: new Date(), lastError: null },
  });
  await client.admissionReviewJob.updateMany({
    where: { application: { userId: input.userId }, status: "WAITING_FOR_CONSENT" },
    data: { status: "QUEUED", stage: "APPLICATION_RECEIVED", availableAt: new Date(), lastError: null, lockedAt: null, heartbeatAt: null },
  });
  return event;
}

export function publicPolicy(policy: Awaited<ReturnType<typeof currentPublishedPolicies>>[number]) {
  return {
    id: policy.id,
    slug: policy.slug,
    title: policy.title,
    summary: policy.summary,
    mandatory: policy.mandatory,
    version: {
      id: policy.currentVersion.id,
      number: policy.currentVersion.version,
      content: policy.currentVersion.content,
      checksum: policy.currentVersion.checksum,
      revisionNote: policy.currentVersion.revisionNote,
      materialChange: policy.currentVersion.materialChange,
      effectiveAt: policy.currentVersion.effectiveAt,
      publishedAt: policy.currentVersion.publishedAt,
    },
  };
}
