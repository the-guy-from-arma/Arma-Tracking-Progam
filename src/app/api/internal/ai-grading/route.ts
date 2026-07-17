import { NextResponse } from "next/server";
import { processNextAiGrade } from "@/lib/ai-grading";

export async function POST(request: Request) {
  const secret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || secret !== process.env.AI_GRADING_WORKER_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await processNextAiGrade());
}
