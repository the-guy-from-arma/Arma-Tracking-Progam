import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

function authorized(request: Request, role?: string) {
  const secret = process.env.WIKI_SYNC_SECRET;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return role === "OWNER" || Boolean(secret && bearer === secret);
}

const wikiBase = "https://community.bohemia.net/wiki";
const seedCategories = ["Category:Arma Reforger/Modding/Tutorials", "Category:Arma Reforger/Modding/Assets/Tutorials", "Category:Arma Reforger/Modding/Scripting/Tutorials", "Category:Arma Reforger/Modding/Official Tools/Workbench/Tutorials"];

async function inventoryWiki() {
  const queue = [...seedCategories]; const visited = new Set<string>(); const pages = new Set<string>();
  while (queue.length && visited.size < 250) {
    const category = queue.shift()!; if (visited.has(category)) continue; visited.add(category);
    let continuation = "";
    do {
      const endpoint = new URL(`${wikiBase}/api.php`); endpoint.search = new URLSearchParams({ action: "query", format: "json", list: "categorymembers", cmtitle: category, cmtype: "page|subcat", cmlimit: "max", ...(continuation ? { cmcontinue: continuation } : {}) }).toString();
      const response = await fetch(endpoint, { headers: { "user-agent": "EnfusionUniversityCurriculum/1.0" }, signal: AbortSignal.timeout(15000) }); if (!response.ok) break;
      const payload = await response.json(); const members = payload.query?.categorymembers || [];
      for (const member of members) member.ns === 14 ? queue.push(member.title) : pages.add(member.title);
      continuation = payload.continue?.cmcontinue || "";
    } while (continuation && pages.size < 2000);
  }
  const courses = await db.course.findMany({ where: { wikiManaged: true }, select: { id: true, title: true } });
  for (const title of pages) {
    const normalized = title.toLowerCase(); const match = courses.find((course) => normalized.includes(course.title.toLowerCase()));
    await db.curriculumSource.upsert({ where: { wikiTitle: title }, update: match ? { courseId: match.id } : {}, create: { wikiTitle: title, url: `${wikiBase}/${encodeURIComponent(title.replaceAll(" ", "_"))}`, sourceExcerpt: "Discovered in the official Arma Reforger curriculum inventory; awaiting source synchronization and faculty mapping.", courseId: match?.id || null } });
  }
  return { categories: visited.size, pages: pages.size };
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!authorized(request, user?.role)) return NextResponse.json({ error: "Owner or sync authority required." }, { status: 403 });
  let inventory = { categories: 0, pages: 0 };
  try { inventory = await inventoryWiki(); } catch { /* Existing curated sources remain available when inventory fails. */ }
  const sources = await db.curriculumSource.findMany({ orderBy: { wikiTitle: "asc" } });
  let updated = 0; let failed = 0; const now = new Date();
  for (let offset = 0; offset < sources.length; offset += 20) {
    const batch = sources.slice(offset, offset + 20); const titles = batch.map((source) => source.wikiTitle).join("|");
    try {
      const endpoint = new URL("https://community.bohemia.net/wiki/api.php");
      endpoint.search = new URLSearchParams({ action: "query", format: "json", redirects: "1", prop: "revisions|extracts|categories", rvprop: "ids|timestamp", exintro: "1", explaintext: "1", cllimit: "max", titles }).toString();
      const response = await fetch(endpoint, { headers: { "user-agent": "EnfusionUniversityCurriculum/1.0" }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`Wiki returned ${response.status}`);
      const payload = await response.json(); const pages = Object.values(payload.query?.pages || {}) as Array<{ title: string; missing?: boolean; extract?: string; revisions?: Array<{ revid: number; timestamp: string }>; categories?: Array<{ title: string }> }>;
      for (const source of batch) {
        const page = pages.find((candidate) => candidate.title === source.wikiTitle) || pages.find((candidate) => candidate.title.replaceAll("_", " ") === source.wikiTitle.replaceAll("_", " "));
        const categories = page?.categories?.map((category) => category.title.replace(/^Category:/, "")) || [];
        const warnings = [...categories.filter((category) => /wip|to-do|outdated|deprecated/i.test(category)), ...(page?.missing ? ["Source page is missing"] : [])];
        await db.curriculumSource.update({ where: { id: source.id }, data: { revisionId: page?.revisions?.[0]?.revid ? String(page.revisions[0].revid) : source.revisionId, revisionTimestamp: page?.revisions?.[0]?.timestamp ? new Date(page.revisions[0].timestamp) : source.revisionTimestamp, categories, statusWarnings: warnings, sourceExcerpt: page?.extract?.slice(0, 1400) || source.sourceExcerpt, syncStatus: warnings.length ? "WARNING" : page ? "UPDATED" : "FAILED", lastSyncedAt: now } });
        page ? updated++ : failed++;
      }
    } catch {
      failed += batch.length;
      await db.curriculumSource.updateMany({ where: { id: { in: batch.map((source) => source.id) } }, data: { syncStatus: "FAILED", lastSyncedAt: now } });
    }
  }
  await db.auditLog.create({ data: { actorId: user?.id || null, action: "CURRICULUM_WIKI_SYNC", entity: "CurriculumSource", detail: { sources: sources.length, updated, failed } } });
  return NextResponse.json({ sources: sources.length, updated, failed, inventory, syncedAt: now });
}
