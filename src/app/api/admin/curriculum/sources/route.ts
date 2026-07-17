import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncCurriculumSource } from "@/lib/curriculum-source-sync";
import { text } from "@/lib/input";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: "Administrative authority required." }, { status: 403 });
  const query = new URL(request.url).searchParams;
  const page = Math.max(1, Number(query.get("page") || 1));
  const pageSize = 25;
  const search = text(query.get("search"), 120);
  const status = text(query.get("status"), 30);
  const courseId = text(query.get("courseId"), 100);
  const where = {
    ...(search ? { OR: [{ wikiTitle: { contains: search, mode: "insensitive" as const } }, { url: { contains: search, mode: "insensitive" as const } }] } : {}),
    ...(status && status !== "ALL" ? { syncStatus: status as never } : {}),
    ...(courseId ? { mappings: { some: { courseId } } } : {}),
  };
  const [items, total, counts, courses] = await Promise.all([
    db.curriculumSource.findMany({ where, include: { mappings: { include: { course: { select: { id: true, code: true, title: true } } } }, attempts: { orderBy: { startedAt: "desc" }, take: 5 } }, orderBy: [{ syncStatus: "desc" }, { wikiTitle: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
    db.curriculumSource.count({ where }),
    db.curriculumSource.groupBy({ by: ["syncStatus"], _count: true }),
    db.course.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, code: true, title: true }, orderBy: { code: "asc" } }),
  ]);
  return NextResponse.json({ items, total, page, pages: Math.max(1, Math.ceil(total / pageSize)), pageSize, counts, courses });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: "Administrative authority required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.map((id: unknown) => text(id, 100)).filter(Boolean).slice(0, 100) : [];
  if (!ids.length) return NextResponse.json({ error: "Select at least one curriculum source." }, { status: 400 });
  if (body.action === "acknowledge") {
    const reason = text(body.reason, 500);
    if (reason.length < 10) return NextResponse.json({ error: "A reason of at least 10 characters is required." }, { status: 400 });
    const sources = await db.curriculumSource.findMany({ where: { id: { in: ids } } });
    await db.$transaction(sources.filter((source) => source.lastSuccessAt).map((source) => db.curriculumSource.update({ where: { id: source.id }, data: { syncStatus: "BYPASSED", bypassedAt: new Date(), bypassReason: reason, bypassRevisionId: source.revisionId, bypassedById: user.id } })));
    await db.auditLog.create({ data: { actorId: user.id, action: "CURRICULUM_SOURCES_BULK_ACKNOWLEDGED", entity: "CurriculumSource", detail: { ids, reason } } });
    return NextResponse.json({ updated: sources.filter((source) => source.lastSuccessAt).length });
  }
  const results = [];
  for (const id of ids) results.push(await syncCurriculumSource(id, { actorId: user.id, force: body.action === "force" }));
  return NextResponse.json({ updated: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length });
}
