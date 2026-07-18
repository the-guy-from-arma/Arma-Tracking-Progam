import { NextResponse } from "next/server";
import { currentPublishedPolicies, getPolicySetting, publicPolicy } from "@/lib/policies";

export async function GET() {
  const [policies, setting] = await Promise.all([currentPublishedPolicies(), getPolicySetting()]);
  return NextResponse.json({
    policies: policies.map(publicPolicy),
    gateActive: setting.gateActive,
    aiDataMode: setting.aiDataMode,
    operators: ["Thunder Buddies Studios", "Black Ridge Studios"],
  });
}
