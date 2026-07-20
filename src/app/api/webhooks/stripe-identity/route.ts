import { NextResponse } from "next/server";
import { handleStripeIdentityEvent, verifyStripeWebhook } from "@/lib/guardian-verification";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyStripeWebhook(rawBody, request.headers.get("stripe-signature")))
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  const event = JSON.parse(rawBody) as Record<string, unknown>;
  const result = await handleStripeIdentityEvent(event);
  return NextResponse.json({ received: true, ...result });
}
