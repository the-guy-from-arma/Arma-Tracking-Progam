import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncCurriculumSource } from "@/lib/curriculum-source-sync";

function authorized(request: Request, role?: string) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return role === "OWNER" || Boolean(process.env.WIKI_SYNC_SECRET && bearer === process.env.WIKI_SYNC_SECRET);
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!authorized(request, user?.role)) return NextResponse.json({ error: "Owner or sync authority required." }, { status: 403 });
  const sources = await db.curriculumSource.findMany({ where: { syncStatus: { not: "DISABLED" } }, select: { id: true }, orderBy: { wikiTitle: "asc" } });
  let updated = 0;
  let failed = 0;
  for (let offset = 0; offset < sources.length; offset += 5) {
    const results = await Promise.all(
      sources.slice(offset, offset + 5).map((source) =>
        syncCurriculumSource(source.id, { actorId: user?.id || null }),
      ),
    );
    for (const result of results) {
      ["FAILED", "WARNING"].includes(result.source.syncStatus) ? failed++ : updated++;
    }
  }
  await db.auditLog.create({ data: { actorId: user?.id || null, action: "CURRICULUM_WIKI_SYNC", entity: "CurriculumSource", detail: { sources: sources.length, updated, failed, mode: "PER_SOURCE_DIAGNOSTIC" } } });
  return NextResponse.json({ sources: sources.length, updated, failed, syncedAt: new Date() });
}
