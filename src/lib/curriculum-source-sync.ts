import crypto from "node:crypto";
import { db } from "@/lib/db";

export type WikiStructuredBlock = {
  kind: "heading" | "paragraph" | "procedure" | "list" | "code" | "table" | "warning";
  anchor: string;
  heading: string;
  text?: string;
  items?: string[];
  rows?: string[][];
};

export type ParsedWikiMedia = {
  url: string;
  fileName: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  altText: string;
  sourceSection: string | null;
  filePageUrl: string | null;
  displayOrder: number;
};

type WikiPage = {
  title: string;
  url: string;
  revisionId: string | null;
  revisionTimestamp: Date | null;
  categories: string[];
  excerpt: string;
  redirectTarget: string | null;
  structuredContent: WikiStructuredBlock[];
  media: ParsedWikiMedia[];
  contentChecksum: string;
};

const wikiOrigin = "https://community.bohemia.net";
const crawlerHeaders = {
  "user-agent": "Mozilla/5.0 (compatible; EnscriptUniversityCurriculum/5.0; +https://enfusion-edu.up.railway.app/)",
  accept: "text/html,application/xhtml+xml",
};

function decodeHtml(value: string) {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—" };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
    if (entity[0] === "#") {
      const hexadecimal = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    }
    return entities[entity.toLowerCase()] || "";
  });
}

function plainText(value: string) {
  return decodeHtml(value.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim());
}

function attr(tag: string, name: string) {
  return decodeHtml(tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1] || "");
}

function anchorFor(value: string, fallback: string) {
  return (value || fallback).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90) || fallback;
}

function pageUrl(title: string) {
  return `${wikiOrigin}/wiki/${encodeURIComponent(title.replaceAll(" ", "_")).replaceAll("%2F", "/")}`;
}

function jsonConfig<T>(html: string, key: string): T | null {
  const match = html.match(new RegExp(`"${key}"\\s*:\\s*([^,}]+)`));
  if (!match) return null;
  try { return JSON.parse(match[1]) as T; } catch { return null; }
}

export function approvedWikiMediaUrl(value: string) {
  try {
    const url = new URL(value, wikiOrigin);
    return url.protocol === "https:" && url.hostname === "community.bohemia.net" && url.pathname.startsWith("/wikidata/images/");
  } catch { return false; }
}

function mediaUrl(value: string) {
  try {
    const url = new URL(decodeHtml(value), wikiOrigin);
    url.protocol = "https:";
    return approvedWikiMediaUrl(url.toString()) ? url.toString() : null;
  } catch { return null; }
}

function mimeFromUrl(url: string) {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".gif")) return "image/gif";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

function parseStructuredContent(content: string) {
  const blocks: Array<WikiStructuredBlock & { position: number }> = [];
  let currentHeading = "Overview";
  const pattern = /<(h[2-6]|p|ol|ul|pre|table)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content))) {
    const tag = match[1].toLowerCase();
    const attrs = match[2] || "";
    const inner = match[3];
    const text = plainText(inner);
    if (!text || text.length < 2) continue;
    if (tag.startsWith("h")) {
      currentHeading = text;
      blocks.push({ kind: "heading", anchor: anchorFor(attr(attrs, "id"), text), heading: text, position: match.index });
      continue;
    }
    const anchor = anchorFor(currentHeading, `section-${blocks.length + 1}`);
    if (tag === "ol" || tag === "ul") {
      const items = [...inner.matchAll(/<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/gi)].map((item) => plainText(item[1])).filter(Boolean);
      if (items.length) blocks.push({ kind: tag === "ol" ? "procedure" : "list", anchor, heading: currentHeading, items, position: match.index });
    } else if (tag === "pre") {
      blocks.push({ kind: "code", anchor, heading: currentHeading, text, position: match.index });
    } else if (tag === "table") {
      const rows = [...inner.matchAll(/<tr(?:\s[^>]*)?>([\s\S]*?)<\/tr>/gi)].map((row) => [...row[1].matchAll(/<t[dh](?:\s[^>]*)?>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => plainText(cell[1])).filter(Boolean)).filter((row) => row.length);
      if (rows.length) blocks.push({ kind: "table", anchor, heading: currentHeading, rows, position: match.index });
    } else {
      const warning = /warning|important|caution|outdated|deprecated/i.test(`${attrs} ${text.slice(0, 80)}`);
      blocks.push({ kind: warning ? "warning" : "paragraph", anchor, heading: currentHeading, text, position: match.index });
    }
  }
  return blocks;
}

function parseMedia(content: string, blocks: Array<WikiStructuredBlock & { position: number }>) {
  const media: ParsedWikiMedia[] = [];
  const seen = new Set<string>();
  const imagePattern = /<img\b[^>]*>/gi;
  let image: RegExpExecArray | null;
  while ((image = imagePattern.exec(content))) {
    const tag = image[0];
    const url = mediaUrl(attr(tag, "src"));
    if (!url || seen.has(url) || /\.svg(?:\?|$)/i.test(url)) continue;
    const nearbyBefore = content.slice(Math.max(0, image.index - 900), image.index);
    const nearbyAfter = content.slice(image.index + tag.length, image.index + tag.length + 700);
    const fileHref = [...nearbyBefore.matchAll(/<a\b[^>]*href=["']([^"']*(?:File|Image):[^"']+)["'][^>]*>/gi)].at(-1)?.[1];
    const captionHtml = nearbyAfter.match(/<(?:div|figcaption)[^>]*class=["'][^"']*(?:thumbcaption|gallerytext)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|figcaption)>/i)?.[1];
    const section = [...blocks].reverse().find((block) => block.position <= image!.index && block.kind === "heading");
    const altText = attr(tag, "alt") || plainText(captionHtml || "") || "Bohemia Workbench example";
    const pathName = new URL(url).pathname;
    const fileName = decodeURIComponent(pathName.split("/").pop() || "workbench-example.png");
    const absoluteFilePage = fileHref ? new URL(decodeHtml(fileHref), wikiOrigin).toString() : null;
    media.push({
      url,
      fileName,
      mimeType: mimeFromUrl(url),
      width: Number(attr(tag, "width")) || null,
      height: Number(attr(tag, "height")) || null,
      caption: plainText(captionHtml || "") || null,
      altText: altText.slice(0, 500),
      sourceSection: section?.heading || null,
      filePageUrl: absoluteFilePage?.startsWith(`${wikiOrigin}/wiki/`) ? absoluteFilePage : null,
      displayOrder: media.length,
    });
    seen.add(url);
  }
  return media;
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
  const content = (contentMatch?.[1] || "").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>/gi, " ");
  const positionedBlocks = parseStructuredContent(content);
  const structuredContent = positionedBlocks.map(({ position: _, ...block }) => block);
  const media = parseMedia(content, positionedBlocks);
  const excerpt = structuredContent.filter((block) => block.text).map((block) => block.text).join(" ").slice(0, 1800);
  const contentChecksum = crypto.createHash("sha256").update(JSON.stringify({ structuredContent, media })).digest("hex");
  return { title: canonicalTitle, url, revisionId: revisionId ? String(revisionId) : null, revisionTimestamp: revisionTimestamp ? new Date(revisionTimestamp) : null, categories, excerpt, redirectTarget, structuredContent, media, contentChecksum };
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
  return [...html.matchAll(/href="\/wiki\/([^"#?]+)"[^>]*data-serp-pos="\d+"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => decodeURIComponent(match[1]).replaceAll("_", " "))
    .filter((title, index, all) => title.startsWith("Arma Reforger:") && all.indexOf(title) === index)
    .map((title) => ({ title, score: similarity(searchTerm, title) }))
    .sort((a, b) => b.score - a.score).slice(0, 8);
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
        await tx.sourceSyncAttempt.create({ data: { sourceId: source.id, actorId: options.actorId || null, mode: options.force ? "FORCE" : "NORMAL", outcome: "WARNING", httpStatus, errorCode: "UNMAPPED_ALIAS", errorMessage: warning, startedAt, detail: { searchSuggestions, transport: "MEDIAWIKI_STRUCTURED_HTML" } } });
        return record;
      });
      return { source: updated, ok: true, warning };
    }
    const warnings = page.categories.filter((item) => /wip|to-do|outdated|deprecated/i.test(item));
    if (page.redirectTarget) warnings.push(`Redirected to ${page.redirectTarget}.`);
    const revisionId = page.revisionId || `checksum-${page.contentChecksum.slice(0, 20)}`;
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
      const existing = await tx.wikiSourceSnapshot.findUnique({ where: { sourceId_revisionId: { sourceId: source.id, revisionId } } });
      if (!existing) {
        await tx.wikiSourceSnapshot.create({ data: {
          sourceId: source.id, revisionId, revisionTimestamp: page.revisionTimestamp, title: page.title, url: pageUrl(page.title), categories: page.categories,
          warnings, structuredContent: page.structuredContent, contentChecksum: page.contentChecksum,
          media: { create: page.media.map((item) => ({ ...item })) },
        } });
      }
      await tx.sourceSyncAttempt.create({ data: { sourceId: source.id, actorId: options.actorId || null, mode: options.force ? "FORCE" : "NORMAL", outcome: syncStatus, httpStatus, revisionId, startedAt, detail: { warnings, revisionChangedAfterBypass, resolvedFromSearch, transport: "MEDIAWIKI_STRUCTURED_HTML", blocks: page.structuredContent.length, media: page.media.length, checksum: page.contentChecksum } } });
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
      await tx.sourceSyncAttempt.create({ data: { sourceId: source.id, actorId: options.actorId || null, mode: options.force ? "FORCE" : "NORMAL", outcome: "FAILED", httpStatus, errorCode, errorMessage, startedAt, detail: { transport: "MEDIAWIKI_STRUCTURED_HTML" } } });
      return record;
    });
    return { source: updated, ok: false, error: errorMessage };
  }
}
