import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";

const categories = new Set(["PRIVACY","ELECTRONIC_RECORDS","ACCOUNT_CLOSURE","BOHEMIA_IP","AI_DECISION","MONETARY_DISCLOSURE","ACCESSIBILITY","TERMS_DISPUTE","OTHER"]);
const tokenHash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export async function POST(request: Request) {
  const user = await currentUser();
  const body = await request.json().catch(() => ({}));
  const requesterName = user?.name || text(body.name, 100);
  const requesterEmail = user?.email || text(body.email, 200);
  const category = categories.has(String(body.category)) ? String(body.category) : "OTHER";
  const subject = text(body.subject, 180);
  const message = text(body.message, 5000);
  if (requesterName.length < 2 || (!user && !requesterEmail.includes("@")) || subject.length < 5 || message.length < 20) return NextResponse.json({ error: "Provide your name, contact email, subject, and a detailed message." }, { status: 400 });
  const dayStart = new Date(Date.now() - 86400000);
  if (!user && await db.policyInquiry.count({ where: { requesterEmail, createdAt: { gte: dayStart } } }) >= 5) return NextResponse.json({ error: "Inquiry limit reached. Try again later." }, { status: 429 });
  const token = user ? null : crypto.randomBytes(24).toString("base64url");
  const trackingNumber = `EFU-POL-${new Date().getUTCFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const inquiry = await db.policyInquiry.create({ data: { trackingNumber, tokenHash: token ? tokenHash(token) : null, userId: user?.id, requesterName, requesterEmail, category: category as never, subject, disputeDeadline: category === "TERMS_DISPUTE" ? new Date(Date.now() + 30 * 86400000) : null, messages: { create: { role: "REQUESTER", authorId: user?.id, body: message } } } });
  await db.auditLog.create({ data: { actorId: user?.id, action: category === "TERMS_DISPUTE" ? "TERMS_DISPUTE_NOTICE_RECEIVED" : "POLICY_INQUIRY_CREATED", entity: "PolicyInquiry", entityId: inquiry.id, detail: { trackingNumber, category } } });
  return NextResponse.json({ trackingNumber, accessToken: token, statusUrl: token ? `/policies/inquiries/${trackingNumber}?token=${encodeURIComponent(token)}` : `/university?view=policies` }, { status: 201 });
}
