import { db } from "@/lib/db";

type WikiPage = { title: string; missing?: boolean; extract?: string; revisions?: Array<{ revid: number; timestamp: string }>; categories?: Array<{ title: string }> };

function cleanError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown synchronization failure";
  return message.replace(/(bearer|token|secret|key)\s*[=:]\s*\S+/gi, "$1=[redacted]").slice(0, 600);
}

export async function syncCurriculumSource(sourceId: string, options: { actorId?: string | null; force?: boolean } = {}) {
  const source = await db.curriculumSource.findUniqueOrThrow({ where: { id: sourceId } });
  if (source.syncStatus === "DISABLED" && !options.force) throw new Error("This source is disabled. Re-enable it before synchronizing.");
  const startedAt = new Date();
  let httpStatus: number | null = null;
  try {
    const endpoint = new URL("https://community.bohemia.net/wiki/api.php");
    endpoint.search = new URLSearchParams({ action: "query", format: "json", redirects: "1", prop: "revisions|extracts|categories", rvprop: "ids|timestamp", exintro: "1", explaintext: "1", cllimit: "max", titles: source.wikiTitle, ...(options.force ? { curtimestamp: "1" } : {}) }).toString();
    const response = await fetch(endpoint, { headers: { "user-agent": "EnfusionUniversityCurriculum/2.0" }, cache: "no-store", signal: AbortSignal.timeout(18000) });
    httpStatus = response.status;
    if (!response.ok) throw new Error(`Bohemia Wiki returned HTTP ${response.status}`);
    const payload = await response.json();
    const page = Object.values(payload.query?.pages || {})[0] as WikiPage | undefined;
    if (!page || page.missing) throw new Error("The Bohemia Wiki page does not exist at the configured title.");
    const categories = page.categories?.map((item) => item.title.replace(/^Category:/, "")) || [];
    const warnings = categories.filter((item) => /wip|to-do|outdated|deprecated/i.test(item));
    const revisionId = page.revisions?.[0]?.revid ? String(page.revisions[0].revid) : source.revisionId;
    const excerpt = page.extract?.trim().slice(0, 1800) || source.lastGoodExcerpt || source.sourceExcerpt;
    const revisionChangedAfterBypass = source.syncStatus === "BYPASSED" && source.bypassRevisionId && revisionId !== source.bypassRevisionId;
    const bypassStillValid = source.syncStatus === "BYPASSED" && source.bypassRevisionId === revisionId;
    const syncStatus = bypassStillValid ? "BYPASSED" : warnings.length || revisionChangedAfterBypass ? "WARNING" : "UPDATED";
    const updated = await db.$transaction(async (tx) => {
      const record = await tx.curriculumSource.update({ where: { id: source.id }, data: {
        wikiTitle: page.title, url: `https://community.bohemia.net/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`,
        revisionId, revisionTimestamp: page.revisions?.[0]?.timestamp ? new Date(page.revisions[0].timestamp) : source.revisionTimestamp,
        categories, statusWarnings: revisionChangedAfterBypass ? [...warnings, "Remote revision changed after warning bypass; review is required again."] : warnings,
        sourceExcerpt: excerpt, syncStatus, lastSyncedAt: new Date(), lastAttemptAt: new Date(), lastSuccessAt: new Date(),
        lastHttpStatus: httpStatus, lastErrorCode: null, lastErrorMessage: null, consecutiveFailures: 0,
        lastGoodRevisionId: revisionId, lastGoodExcerpt: excerpt,
        ...(revisionChangedAfterBypass ? { bypassedAt: null, bypassReason: null, bypassRevisionId: null, bypassedById: null } : {}),
      } });
      await tx.sourceSyncAttempt.create({ data: { sourceId: source.id, actorId: options.actorId || null, mode: options.force ? "FORCE" : "NORMAL", outcome: syncStatus, httpStatus, revisionId, startedAt, detail: { warnings, revisionChangedAfterBypass } } });
      return record;
    });
    return { source: updated, ok: true };
  } catch (error) {
    const errorMessage = cleanError(error);
    const errorCode = httpStatus ? `HTTP_${httpStatus}` : error instanceof DOMException && error.name === "TimeoutError" ? "TIMEOUT" : "SYNC_ERROR";
    const updated = await db.$transaction(async (tx) => {
      const record = await tx.curriculumSource.update({ where: { id: source.id }, data: { syncStatus: source.bypassedAt ? "BYPASSED" : "FAILED", lastAttemptAt: new Date(), lastHttpStatus: httpStatus, lastErrorCode: errorCode, lastErrorMessage: errorMessage, consecutiveFailures: { increment: 1 } } });
      await tx.sourceSyncAttempt.create({ data: { sourceId: source.id, actorId: options.actorId || null, mode: options.force ? "FORCE" : "NORMAL", outcome: "FAILED", httpStatus, errorCode, errorMessage, startedAt } });
      return record;
    });
    return { source: updated, ok: false, error: errorMessage };
  }
}
