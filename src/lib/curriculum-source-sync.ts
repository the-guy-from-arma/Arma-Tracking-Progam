import { db } from "@/lib/db";

type WikiPage = {
  title: string;
  url: string;
  revisionId: string | null;
  revisionTimestamp: Date | null;
  categories: string[];
  excerpt: string;
  redirectTarget: string | null;
};

const wikiOrigin = "https://community.bohemia.net";
const crawlerHeaders = {
  "user-agent": "Mozilla/5.0 (compatible; EnscriptUniversityCurriculum/4.0; +https://enfusion-edu.up.railway.app/)",
  accept: "text/html,application/xhtml+xml",
};

function decodeHtml(value: string) {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
    if (entity[0] === "#") {
      const hexadecimal = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    }
    return entities[entity.toLowerCase()] || "";
  });
}

function pageUrl(title: string) {
  return `${wikiOrigin}/wiki/${encodeURIComponent(title.replaceAll(" ", "_")).replaceAll("%2F", "/")}`;
}

function jsonConfig<T>(html: string, key: string): T | null {
  const match = html.match(new RegExp(`"${key}"\\s*:\\s*([^,}]+)`));
  if (!match) return null;
  try { return JSON.parse(match[1]) as T; } catch { return null; }
}

function parsePage(html: string, requestedTitle: string, url: string): WikiPage {
  const pageName = jsonConfig<string>(html, "wgPageName")?.replaceAll("_", " ") || requestedTitle;
  const revisionId = jsonConfig<number>(html, "wgRevisionId");
  const categories = jsonConfig<string[]>(html, "wgCategories") || [];
  const revisionTimestamp = jsonConfig<string>(html, "wgRevisionTimestamp");
  const redirectMatch = html.match(/<link rel="canonical" href="https:\/\/community\.(?:bohemia\.net|bistudio\.com)\/wiki\/([^"?#]+)"/i);
  const canonicalTitle = redirectMatch ? decodeURIComponent(redirectMatch[1]).replaceAll("_", " ") : pageName;
  const redirectTarget = canonicalTitle.toLowerCase() !== requestedTitle.replaceAll("_", " ").toLowerCase() ? canonicalTitle : null;
  const contentMatch = html.match(/<div class="mw-parser-output">([\s\S]*?)(?:<div[^>]+id="catlinks"|<div[^>]+class="printfooter"|<\/main>)/i);
  const excerpt = decodeHtml((contentMatch?.[1] || "")
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<table[\s\S]*?<\/table>|<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()).slice(0, 1800);
  return { title: canonicalTitle, url, revisionId: revisionId ? String(revisionId) : null, revisionTimestamp: revisionTimestamp ? new Date(revisionTimestamp) : null, categories, excerpt, redirectTarget };
}

async function fetchWikiPage(title: string) {
  const url = pageUrl(title);
  const response = await fetch(url, { headers: crawlerHeaders, cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(18000) });
  if (response.status === 404 || response.status === 410) return { page: null, status: response.status, url };
  if (!response.ok) throw Object.assign(new Error(`Bohemia Wiki returned HTTP ${response.status}`), { status: response.status });
  const html = await response.text();
  const isArticle = jsonConfig<boolean>(html, "wgIsArticle");
  if (isArticle === false || /noarticletext|There is currently no text in this page/i.test(html)) return { page: null, status: 404, url };
  return { page: parsePage(html, title, response.url || url), status: response.status, url };
}

function similarity(left: string, right: string) {
  const words = (value: string) => new Set(value.toLowerCase().replace(/^arma reforger:/, "").split(/[^a-z0-9]+/).filter((word) => word.length > 2));
  const a = words(left); const b = words(right); const overlap = [...a].filter((word) => b.has(word)).length;
  return overlap / Math.max(1, new Set([...a, ...b]).size);
}

async function searchWiki(searchTerm: string) {
  const url = `${wikiOrigin}/wiki/Special:Search?search=${encodeURIComponent(`${searchTerm} Arma Reforger`)}`;
  const response = await fetch(url, { headers: crawlerHeaders, cache: "no-store", signal: AbortSignal.timeout(18000) });
  if (!response.ok) return [];
  const html = await response.text();
  const candidates = [...html.matchAll(/href="\/wiki\/([^"#?]+)"[^>]*data-serp-pos="\d+"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => decodeURIComponent(match[1]).replaceAll("_", " "))
    .filter((title, index, all) => title.startsWith("Arma Reforger:") && all.indexOf(title) === index)
    .map((title) => ({ title, score: similarity(searchTerm, title) }))
    .sort((a, b) => b.score - a.score);
  return candidates.slice(0, 8);
}

function cleanError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown synchronization failure";
  return message.replace(/(bearer|token|secret|key)\s*[=:]\s*\S+/gi, "$1=[redacted]").slice(0, 600);
}

export async function syncCurriculumSource(sourceId: string, options: { actorId?: string | null; force?: boolean } = {}) {
  const source = await db.curriculumSource.findUniqueOrThrow({ where: { id: sourceId }, include: { mappings: { include: { course: { select: { title: true } } } } } });
  if (source.syncStatus === "DISABLED" && !options.force) throw new Error("This source is disabled. Re-enable it before synchronizing.");
  const startedAt = new Date();
  let httpStatus: number | null = null;
  try {
    let fetched = await fetchWikiPage(source.wikiTitle);
    httpStatus = fetched.status;
    let page = fetched.page;
    let resolvedFromSearch = false;
    let searchSuggestions: string[] = [];
    if (!page) {
      const searchTerm = source.mappings[0]?.course.title || source.wikiTitle.replace(/^Arma Reforger:/, "");
      const candidates = await searchWiki(searchTerm);
      searchSuggestions = candidates.slice(0, 4).map((candidate) => candidate.title);
      if (candidates[0]?.score >= 0.5) {
        fetched = await fetchWikiPage(candidates[0].title);
        httpStatus = fetched.status;
        page = fetched.page;
        resolvedFromSearch = Boolean(page);
      }
    }
    if (!page) {
      const warning = `No verified Bohemia Wiki page matched this curriculum alias.${searchSuggestions.length ? ` Review suggestions: ${searchSuggestions.join(", ")}.` : ""}`;
      const updated = await db.$transaction(async (tx) => {
        const record = await tx.curriculumSource.update({ where: { id: source.id }, data: { syncStatus: "WARNING", statusWarnings: [warning], lastAttemptAt: new Date(), lastHttpStatus: httpStatus, lastErrorCode: "UNMAPPED_ALIAS", lastErrorMessage: warning, consecutiveFailures: { increment: 1 } } });
        await tx.sourceSyncAttempt.create({ data: { sourceId: source.id, actorId: options.actorId || null, mode: options.force ? "FORCE" : "NORMAL", outcome: "WARNING", httpStatus, errorCode: "UNMAPPED_ALIAS", errorMessage: warning, startedAt, detail: { searchSuggestions, transport: "MEDIAWIKI_HTML" } } });
        return record;
      });
      return { source: updated, ok: true, warning };
    }
    const warnings = page.categories.filter((item) => /wip|to-do|outdated|deprecated/i.test(item));
    if (page.redirectTarget) warnings.push(`Redirected to ${page.redirectTarget}.`);
    const revisionId = page.revisionId || source.revisionId;
    const excerpt = page.excerpt || source.lastGoodExcerpt || source.sourceExcerpt;
    const revisionChangedAfterBypass = source.syncStatus === "BYPASSED" && source.bypassRevisionId && revisionId !== source.bypassRevisionId;
    const bypassStillValid = source.syncStatus === "BYPASSED" && source.bypassRevisionId === revisionId;
    const syncStatus = bypassStillValid ? "BYPASSED" : warnings.length || revisionChangedAfterBypass || resolvedFromSearch ? "WARNING" : "UPDATED";
    const updated = await db.$transaction(async (tx) => {
      const record = await tx.curriculumSource.update({ where: { id: source.id }, data: {
        wikiTitle: page.title, url: pageUrl(page.title), revisionId, revisionTimestamp: page.revisionTimestamp || source.revisionTimestamp,
        categories: page.categories, statusWarnings: revisionChangedAfterBypass ? [...warnings, "Remote revision changed after warning bypass; review is required again."] : warnings,
        sourceExcerpt: excerpt, syncStatus, lastSyncedAt: new Date(), lastAttemptAt: new Date(), lastSuccessAt: new Date(),
        lastHttpStatus: httpStatus, lastErrorCode: null, lastErrorMessage: null, consecutiveFailures: 0,
        lastGoodRevisionId: revisionId, lastGoodExcerpt: excerpt,
        ...(revisionChangedAfterBypass ? { bypassedAt: null, bypassReason: null, bypassRevisionId: null, bypassedById: null } : {}),
      } });
      await tx.sourceSyncAttempt.create({ data: { sourceId: source.id, actorId: options.actorId || null, mode: options.force ? "FORCE" : "NORMAL", outcome: syncStatus, httpStatus, revisionId, startedAt, detail: { warnings, revisionChangedAfterBypass, resolvedFromSearch, transport: "MEDIAWIKI_HTML" } } });
      return record;
    });
    return { source: updated, ok: true };
  } catch (error) {
    const errorMessage = cleanError(error);
    const errorStatus = typeof error === "object" && error && "status" in error ? Number((error as { status: unknown }).status) : null;
    httpStatus = errorStatus || httpStatus;
    const errorCode = httpStatus ? `HTTP_${httpStatus}` : error instanceof DOMException && error.name === "TimeoutError" ? "TIMEOUT" : "SYNC_ERROR";
    const updated = await db.$transaction(async (tx) => {
      const record = await tx.curriculumSource.update({ where: { id: source.id }, data: { syncStatus: source.bypassedAt ? "BYPASSED" : "FAILED", lastAttemptAt: new Date(), lastHttpStatus: httpStatus, lastErrorCode: errorCode, lastErrorMessage: errorMessage, consecutiveFailures: { increment: 1 } } });
      await tx.sourceSyncAttempt.create({ data: { sourceId: source.id, actorId: options.actorId || null, mode: options.force ? "FORCE" : "NORMAL", outcome: "FAILED", httpStatus, errorCode, errorMessage, startedAt, detail: { transport: "MEDIAWIKI_HTML" } } });
      return record;
    });
    return { source: updated, ok: false, error: errorMessage };
  }
}
