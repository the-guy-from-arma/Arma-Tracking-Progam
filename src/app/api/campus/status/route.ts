import { NextResponse } from "next/server";
import { campusStatus } from "@/lib/campus-operations";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await campusStatus());
}
