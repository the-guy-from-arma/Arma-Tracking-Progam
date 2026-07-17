import { NextResponse } from "next/server";
import { renewEligibleFundingTerms } from "@/lib/funding";

export async function POST(request: Request) {
  const secret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || secret !== process.env.FUNDING_RENEWAL_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await renewEligibleFundingTerms());
}
