import { NextResponse } from "next/server";
import { publicCampusStatus } from "@/lib/campus-operations";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await publicCampusStatus(), {
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
