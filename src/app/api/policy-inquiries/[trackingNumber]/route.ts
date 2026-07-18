import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request, context: { params: Promise<{ trackingNumber: string }> }) {
  const { trackingNumber } = await context.params;
  const user = await currentUser();
  const inquiry = await db.policyInquiry.findUnique({ where: { trackingNumber }, include: { messages: { orderBy: { createdAt: "asc" }, select: { role: true, body: true, createdAt: true } } } });
  if (!inquiry) return NextResponse.json({ error: "Inquiry not found." }, { status: 404 });
  const token = new URL(request.url).searchParams.get("token") || "";
  const tokenValid = Boolean(inquiry.tokenHash && crypto.createHash("sha256").update(token).digest("hex") === inquiry.tokenHash);
  if ((!user || inquiry.userId !== user.id) && !tokenValid) return NextResponse.json({ error: "Valid inquiry access is required." }, { status: 403 });
  return NextResponse.json({ inquiry: { trackingNumber, requesterName: inquiry.requesterName, category: inquiry.category, subject: inquiry.subject, status: inquiry.status, disputeDeadline: inquiry.disputeDeadline, createdAt: inquiry.createdAt, messages: inquiry.messages } });
}
