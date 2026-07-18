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
  let ids: string[] = Array.isArray(body.ids) ? body.ids.map((id: unknown) => text(id, 100)).filter(Boolean).slice(0, 1000) : [];
  const scope = text(body.scope, 30);
  if (!ids.length && (scope === "issues" || scope === "all" || scope === "filtered")) {
    const search = text(body.search, 120);
    const status = text(body.status, 30);
    const courseId = text(body.courseId, 100);
    const scoped = await db.curriculumSource.findMany({
      where: {
        ...(scope === "issues" ? { syncStatus: { in: ["FAILED", "WARNING"] as never[] } } : { syncStatus: { not: "DISABLED" as never } }),
        ...(scope === "filtered" && search ? { OR: [{ wikiTitle: { contains: search, mode: "insensitive" as const } }, { url: { contains: search, mode: "insensitive" as const } }] } : {}),
        ...(scope === "filtered" && status && status !== "ALL" ? { syncStatus: status as never } : {}),
        ...(scope === "filtered" && courseId ? { mappings: { some: { courseId } } } : {}),
      },
      select: { id: true },
      orderBy: { wikiTitle: "asc" },
      take: 1000,
    });
    ids = scoped.map((source) => source.id);
  }
  if (!ids.length) return NextResponse.json({ error: "Select at least one curriculum source." }, { status: 400 });
  if (body.action === "acknowledge") {
    const reason = text(body.reason, 500);
    if (reason.length < 10) return NextResponse.json({ error: "A reason of at least 10 characters is required." }, { status: 400 });
    const sources = await db.curriculumSource.findMany({ where: { id: { in: ids } } });
    await db.$transaction(sources.filter((source) => source.lastSuccessAt).map((source) => db.curriculumSource.update({ where: { id: source.id }, data: { syncStatus: "BYPASSED", bypassedAt: new Date(), bypassReason: reason, bypassRevisionId: source.revisionId, bypassedById: user.id } })));
    await db.auditLog.create({ data: { actorId: user.id, action: "CURRICULUM_SOURCES_BULK_ACKNOWLEDGED", entity: "CurriculumSource", detail: { ids, reason } } });
    return NextResponse.json({ updated: sources.filter((source) => source.lastSuccessAt).length });
  }
  const results: Awaited<ReturnType<typeof syncCurriculumSource>>[] = [];
  for (let offset = 0; offset < ids.length; offset += 5) {
    const batch = ids.slice(offset, offset + 5);
    results.push(...await Promise.all(batch.map(async (id) => {
      try {
        return await syncCurriculumSource(id, { actorId: user.id, force: body.action === "force" || body.action === "resolve" });
      } catch (error) {
        const source = await db.curriculumSource.findUniqueOrThrow({ where: { id } });
        return { source, ok: false, error: error instanceof Error ? error.message : "Source synchronization failed." };
      }
    })));
  }

  if (body.action === "resolve") {
    const bypassReason = "Bulk resolution retained the last successfully verified source because the current remote response still requires review.";
    const eligible = results.filter((item) => ["FAILED", "WARNING"].includes(item.source.syncStatus) && item.source.lastSuccessAt);
    if (eligible.length) {
      await db.$transaction(eligible.map((item) => db.curriculumSource.update({
        where: { id: item.source.id },
        data: {
          syncStatus: "BYPASSED",
          bypassedAt: new Date(),
          bypassReason,
          bypassRevisionId: item.source.revisionId || item.source.lastGoodRevisionId,
          bypassedById: user.id,
        },
      })));
    }
    const needsCorrection = results.filter((item) => ["FAILED", "WARNING"].includes(item.source.syncStatus) && !item.source.lastSuccessAt).length;
    const resolved = results.length - needsCorrection;
    await db.auditLog.create({
      data: {
        actorId: user.id,
        action: "CURRICULUM_SOURCES_BULK_RESOLVED",
        entity: "CurriculumSource",
        detail: { ids, resolved, bypassed: eligible.length, needsCorrection, bypassReason },
      },
    });
    return NextResponse.json({ processed: results.length, resolved, bypassed: eligible.length, needsCorrection });
  }

  const attention = results.filter((item) => !item.ok || ["FAILED", "WARNING"].includes(item.source.syncStatus)).length;
  return NextResponse.json({ processed: results.length, updated: results.length - attention, failed: attention });
}
