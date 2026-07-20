import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { processNextCurriculumCompilation } from "@/lib/curriculum-compiler";

function authorized(request: Request) {
  const expected = process.env.CURRICULUM_COMPILER_WORKER_SECRET || "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || expected.length < 32 || expected.length !== supplied.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Worker authorization required." }, { status: 401 });
  const concurrency = Math.max(1, Math.min(4, Number(process.env.CURRICULUM_COMPILER_CONCURRENCY || 2)));
  const results = await Promise.all(Array.from({ length: concurrency }, () => processNextCurriculumCompilation()));
  return NextResponse.json({ results });
}
