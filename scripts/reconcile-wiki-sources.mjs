import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const reportOnly = process.env.RECONCILE_APPLY !== "true";
const api = "https://community.bohemia.net/wiki/api.php";

function similarity(left, right) {
  const a = new Set(left.toLowerCase().replace(/^arma reforger:/, "").split(/\W+/).filter(Boolean));
  const b = new Set(right.toLowerCase().replace(/^arma reforger:/, "").split(/\W+/).filter(Boolean));
  const overlap = [...a].filter((word) => b.has(word)).length;
  return overlap / Math.max(1, new Set([...a, ...b]).size);
}

try {
  const sources = await db.curriculumSource.findMany({ where: { OR: [{ syncStatus: { in: ["FAILED", "WARNING"] } }, { lastSuccessAt: null }] }, include: { mappings: { include: { course: { select: { title: true } } } } }, orderBy: { wikiTitle: "asc" } });
  const report = [];
  for (const source of sources) {
    const search = source.mappings[0]?.course.title || source.wikiTitle.replace(/^Arma Reforger:/, "");
    const endpoint = new URL(api); endpoint.search = new URLSearchParams({ action: "query", format: "json", list: "search", srsearch: `${search} incategory:\"Arma Reforger\"`, srlimit: "5" }).toString();
    try {
      const response = await fetch(endpoint, { headers: { "user-agent": "EnfusionUniversityReconciliation/1.0" }, signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const candidates = (await response.json()).query?.search || [];
      const ranked = candidates.map((candidate) => ({ title: candidate.title, score: similarity(search, candidate.title), url: `https://community.bohemia.net/wiki/${encodeURIComponent(candidate.title.replaceAll(" ", "_"))}` })).sort((a, b) => b.score - a.score);
      const best = ranked[0]; const highConfidence = best && best.score >= 0.6;
      report.push({ id: source.id, current: source.wikiTitle, search, highConfidence, suggestion: best || null, alternatives: ranked.slice(1, 3) });
      if (!reportOnly && highConfidence) await db.curriculumSource.update({ where: { id: source.id }, data: { wikiTitle: best.title, url: best.url, syncStatus: "WARNING", lastErrorMessage: "High-confidence reconciliation applied; synchronization verification required." } });
    } catch (error) { report.push({ id: source.id, current: source.wikiTitle, search, error: error instanceof Error ? error.message : "Search failed" }); }
  }
  console.log(JSON.stringify({ mode: reportOnly ? "REPORT_ONLY" : "APPLY_HIGH_CONFIDENCE", reviewed: sources.length, highConfidence: report.filter((item) => item.highConfidence).length, report }, null, 2));
} finally { await db.$disconnect(); }
