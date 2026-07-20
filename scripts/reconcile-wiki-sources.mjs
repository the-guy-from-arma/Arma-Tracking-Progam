import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const reportOnly = process.env.RECONCILE_APPLY !== "true";
const wikiOrigin = "https://community.bohemia.net";
const headers = { "user-agent": "Mozilla/5.0 (compatible; EnscriptUniversityReconciliation/3.0; +https://enfusion-edu.up.railway.app/)", accept: "text/html,application/xhtml+xml" };

async function wikiSearch(search) {
  const response = await fetch(`${wikiOrigin}/wiki/Special:Search?search=${encodeURIComponent(`${search} Arma Reforger`)}`, { headers, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Bohemia Wiki search returned HTTP ${response.status}`);
  const html = await response.text();
  return [...html.matchAll(/href="\/wiki\/([^"#?]+)"[^>]*data-serp-pos="\d+"/gi)]
    .map((match) => decodeURIComponent(match[1]).replaceAll("_", " "))
    .filter((title, index, all) => title.startsWith("Arma Reforger:") && all.indexOf(title) === index);
}

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
    try {
      const candidates = await wikiSearch(search);
      const ranked = candidates.map((title) => ({ title, score: similarity(search, title), url: `https://community.bohemia.net/wiki/${encodeURIComponent(title.replaceAll(" ", "_")).replaceAll("%2F", "/")}` })).sort((a, b) => b.score - a.score);
      const best = ranked[0]; const highConfidence = best && best.score >= 0.6;
      report.push({ id: source.id, current: source.wikiTitle, search, highConfidence, suggestion: best || null, alternatives: ranked.slice(1, 3) });
      if (!reportOnly && highConfidence) await db.curriculumSource.update({ where: { id: source.id }, data: { wikiTitle: best.title, url: best.url, syncStatus: "WARNING", lastErrorMessage: "High-confidence reconciliation applied; synchronization verification required." } });
    } catch (error) { report.push({ id: source.id, current: source.wikiTitle, search, error: error instanceof Error ? error.message : "Search failed" }); }
  }
  console.log(JSON.stringify({ mode: reportOnly ? "REPORT_ONLY" : "APPLY_HIGH_CONFIDENCE", reviewed: sources.length, highConfidence: report.filter((item) => item.highConfidence).length, report }, null, 2));
} finally { await db.$disconnect(); }
