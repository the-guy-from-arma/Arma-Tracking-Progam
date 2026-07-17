import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";

function approvedWikiUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "community.bohemia.net" && url.pathname.startsWith("/wiki/"); }
  catch { return false; }
}

export async function GET(_: Request, { params }: { params: Promise<{ sourceId: string }> }) {
  const user = await currentUser();
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: "Administrative authority required." }, { status: 403 });
  const { sourceId } = await params;
  const source = await db.curriculumSource.findUnique({ where: { id: sourceId }, include: { mappings: { include: { course: { select: { id: true, code: true, title: true } } } }, attempts: { orderBy: { startedAt: "desc" }, take: 25 } } });
  return source ? NextResponse.json({ source }) : NextResponse.json({ error: "Source not found." }, { status: 404 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ sourceId: string }> }) {
  const user = await currentUser();
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: "Administrative authority required." }, { status: 403 });
  const { sourceId } = await params;
  const source = await db.curriculumSource.findUnique({ where: { id: sourceId } });
  if (!source) return NextResponse.json({ error: "Source not found." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const action = text(body.action, 30);
  if (action === "bypass") {
    const reason = text(body.reason, 500);
    if (!source.lastSuccessAt) return NextResponse.json({ error: "A source that has never synchronized successfully cannot be approved for Gemini grounding." }, { status: 409 });
    if (reason.length < 10) return NextResponse.json({ error: "Explain the bypass in at least 10 characters." }, { status: 400 });
    await db.curriculumSource.update({ where: { id: source.id }, data: { syncStatus: "BYPASSED", bypassedAt: new Date(), bypassReason: reason, bypassRevisionId: source.revisionId, bypassedById: user.id } });
  } else if (action === "disable") {
    const reason = text(body.reason, 500);
    if (reason.length < 10) return NextResponse.json({ error: "Explain why this source is being disabled." }, { status: 400 });
    await db.curriculumSource.update({ where: { id: source.id }, data: { syncStatus: "DISABLED", disabledAt: new Date(), lastErrorMessage: reason } });
  } else if (action === "enable") {
    await db.curriculumSource.update({ where: { id: source.id }, data: { syncStatus: source.lastSuccessAt ? "CURRENT" : "WARNING", disabledAt: null } });
  } else if (action === "correct") {
    const wikiTitle = text(body.wikiTitle, 240); const url = text(body.url, 500);
    const courseIds: string[] = Array.isArray(body.courseIds) ? body.courseIds.map((value: unknown) => text(value, 100)).filter((value: string) => Boolean(value)) : [];
    if (!wikiTitle || !approvedWikiUrl(url)) return NextResponse.json({ error: "Provide a title and an approved community.bohemia.net Wiki URL." }, { status: 400 });
    await db.$transaction(async (tx) => {
      await tx.curriculumSource.update({ where: { id: source.id }, data: { wikiTitle, url, syncStatus: source.lastSuccessAt ? "WARNING" : "FAILED", lastErrorMessage: "Source configuration changed; retry synchronization to verify it." } });
      await tx.courseSourceMapping.deleteMany({ where: { sourceId: source.id } });
      if (courseIds.length) await tx.courseSourceMapping.createMany({ data: [...new Set(courseIds)].map((courseId) => ({ courseId, sourceId: source.id })), skipDuplicates: true });
    });
  } else return NextResponse.json({ error: "Unknown curriculum source action." }, { status: 400 });
  await db.auditLog.create({ data: { actorId: user.id, action: `CURRICULUM_SOURCE_${action.toUpperCase()}`, entity: "CurriculumSource", entityId: source.id, detail: { reason: text(body.reason, 500), wikiTitle: text(body.wikiTitle, 240), url: text(body.url, 500), courseIds: body.courseIds || [] } } });
  return GET(request, { params: Promise.resolve({ sourceId }) });
}
