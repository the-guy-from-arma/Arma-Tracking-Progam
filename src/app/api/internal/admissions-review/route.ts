import { NextResponse } from "next/server";
import { processNextAdmissionReview } from "@/lib/admissions-automation";

export async function POST(request: Request) {
  const secret = process.env.ADMISSIONS_WORKER_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await processNextAdmissionReview());
}
