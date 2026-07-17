import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { syncCurriculumSource } from "@/lib/curriculum-source-sync";

export async function POST(request: Request, { params }: { params: Promise<{ sourceId: string }> }) {
  const user = await currentUser();
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: "Administrative authority required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const { sourceId } = await params;
  const result = await syncCurriculumSource(sourceId, { actorId: user.id, force: body.force === true });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
