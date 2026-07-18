import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { policyCompliance, publicPolicy } from "@/lib/policies";

export async function GET() {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const [compliance, signatures, inquiries, history] = await Promise.all([
    policyCompliance(user.id),
    db.policySignatureEvent.findMany({ where: { userId: user.id }, orderBy: { signedAt: "desc" }, include: { acceptances: { include: { policyVersion: { include: { document: true } } } } } }),
    db.policyInquiry.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { messages: { orderBy: { createdAt: "asc" } } } }),
    db.policyVersion.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ document: { sortOrder: "asc" } }, { version: "desc" }], include: { document: true } }),
  ]);
  return NextResponse.json({ policyCompliant: compliance.compliant, gateActive: compliance.gateActive, missingPolicyVersions: compliance.missing.map((item) => ({ slug: item.slug, title: item.title, version: item.currentVersion.version })), policies: compliance.policies.map(publicPolicy), history: history.map((version) => ({ id: version.id, slug: version.document.slug, title: version.document.title, version: version.version, effectiveAt: version.effectiveAt, materialChange: version.materialChange, revisionNote: version.revisionNote, checksum: version.checksum })), signatures: signatures.map((event) => ({ id: event.id, receiptNumber: event.receiptNumber, signerName: event.signerName, signedAt: event.signedAt, policies: event.acceptances.map((acceptance) => ({ title: acceptance.policyVersion.document.title, slug: acceptance.policyVersion.document.slug, version: acceptance.policyVersion.version, checksum: acceptance.policyVersion.checksum })) })), inquiries: inquiries.map((inquiry) => ({ trackingNumber: inquiry.trackingNumber, category: inquiry.category, subject: inquiry.subject, status: inquiry.status, disputeDeadline: inquiry.disputeDeadline, createdAt: inquiry.createdAt, messages: inquiry.messages.map((message) => ({ role: message.role, body: message.body, createdAt: message.createdAt })) })) });
}
