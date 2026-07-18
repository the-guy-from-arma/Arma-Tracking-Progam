import { NextResponse } from "next/server";
import { currentPublishedPolicies, publicPolicy } from "@/lib/policies";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const policy = (await currentPublishedPolicies()).find((item) => item.slug === slug);
  if (!policy) return NextResponse.json({ error: "Published policy not found." }, { status: 404 });
  return NextResponse.json({ policy: publicPolicy(policy) });
}
