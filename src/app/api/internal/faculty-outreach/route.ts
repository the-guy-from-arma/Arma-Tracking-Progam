import { NextResponse } from "next/server";
import { runFacultyOutreach } from "@/lib/faculty-network";

export async function POST(request: Request) {
  const secret = process.env.FACULTY_OUTREACH_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runFacultyOutreach());
}
