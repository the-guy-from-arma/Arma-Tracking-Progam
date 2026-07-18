import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deploymentFingerprint } from "@/lib/build-info";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "nominal",
      database: "connected",
      deployment: deploymentFingerprint(),
    });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        database: "unavailable",
        deployment: deploymentFingerprint(),
      },
      { status: 503 },
    );
  }
}
