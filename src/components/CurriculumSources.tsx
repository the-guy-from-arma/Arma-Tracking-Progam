"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./OperationsWorkspace.module.css";

type Attempt = {
  id: string;
  outcome: string;
  mode: string;
  httpStatus: number | null;
  errorMessage: string | null;
  startedAt: string;
  revisionId: string | null;
};

type Source = {
  id: string;
  wikiTitle: string;
  url: string;
  syncStatus: string;
  statusWarnings: string[];
  sourceExcerpt: string;
  revisionId: string | null;
  lastGoodRevisionId: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastHttpStatus: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  consecutiveFailures: number;
  bypassReason: string | null;
  mappings: { course: { id: string; code: string; title: string } }[];
  attempts: Attempt[];
};

type Data = {
  items: Source[];
  total: number;
  page: number;
  pages: number;
  counts: { syncStatus: string; _count: number }[];
  courses: { id: string; code: string; title: string }[];
};

export function CurriculumSources() {
  const [data, setData] = useState<Data | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [courseId, setCourseId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [allIssuesSelected, setAllIssuesSelected] = useState(false);
  const [open, setOpen] = useState<Source | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const query = new URLSearchParams({ page: String(page), search, status, courseId });
    const response = await fetch(`/api/admin/curriculum/sources?${query}`, { cache: "no-store" });
    const result = await response.json();
    if (response.ok) setData(result);
    else setMessage(result.error || "Curriculum sources could not be loaded.");
  }, [page, search, status, courseId]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 200);
    return () => clearTimeout(timer);
  }, [load]);

  const count = useMemo(
    () => Object.fromEntries(data?.counts.map((item) => [item.syncStatus, item._count]) || []),
    [data],
  );
  const issueCount = (count.FAILED || 0) + (count.WARNING || 0);
  const pageIds = data?.items.map((source) => source.id) || [];
  const pageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  function selectionPayload() {
    return allIssuesSelected
      ? { scope: "issues" }
      : { ids: selected };
  }

  async function bulkAction(
    action: "retry" | "force" | "resolve" | "acknowledge",
    reason?: string,
    overrideSelection?: { ids?: string[]; scope?: "issues" },
  ) {
    setBusy(true);
    setMessage(
      action === "resolve"
        ? "Resolving every selected source that can be safely verified or retained…"
        : action === "force"
          ? "Force-updating selected sources…"
          : action === "acknowledge"
            ? "Recording the approved last-good decision…"
            : "Retrying selected sources…",
    );
    try {
      const response = await fetch("/api/admin/curriculum/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reason, ...(overrideSelection || selectionPayload()) }),
      });
      const result = await response.json();
      if (!response.ok) setMessage(result.error || "The bulk source action failed.");
      else if (action === "resolve") {
        setMessage(`${result.resolved} resolved · ${result.bypassed} retained from last-good · ${result.needsCorrection} still require URL or mapping correction`);
      } else if (action === "acknowledge") {
        setMessage(`${result.updated} eligible sources now retain their verified last-good revision.`);
      } else {
        setMessage(`${result.updated} current · ${result.failed} still need review`);
      }
      if (response.ok) {
        setSelected([]);
        setAllIssuesSelected(false);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function syncAll() {
    setBusy(true);
    setMessage("Synchronizing every enabled official source…");
    try {
      const response = await fetch("/api/admin/curriculum/sync", { method: "POST" });
      const result = await response.json();
      setMessage(
        response.ok
          ? `${result.updated} synchronized · ${result.failed} require review · ${result.sources} processed`
          : result.error || "The complete synchronization could not be started.",
      );
      if (response.ok) await load();
    } finally {
      setBusy(false);
    }
  }

  async function sourceAction(action: string, payload: Record<string, unknown> = {}) {
    if (!open) return;
    const response = await fetch(`/api/admin/curriculum/sources/${open.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const result = await response.json();
    setMessage(response.ok ? `${open.wikiTitle}: ${action} recorded.` : result.error);
    if (response.ok) {
      setOpen(result.source);
      await load();
    }
  }

  function togglePage() {
    setAllIssuesSelected(false);
    setSelected((current) =>
      pageSelected
        ? current.filter((id) => !pageIds.includes(id))
        : [...new Set([...current, ...pageIds])],
    );
  }

  return (
    <section className={styles.workspace}>
      <header className={styles.hero}>
        <div>
          <small>ACADEMIC OPERATIONS / SOURCE AUTHORITY</small>
          <h1>Curriculum Sources</h1>
          <p>Diagnose official Bohemia sources, preserve verified last-good records, and maintain course grounding without altering faculty-authored instruction.</p>
        </div>
        <button disabled={busy} onClick={() => void syncAll()}>
          {busy ? "SOURCE OPERATION RUNNING…" : "SYNC ALL OFFICIAL SOURCES"}
        </button>
      </header>

      <div className={styles.metrics}>
        <article><b>{data?.total || 0}</b><span>IN CURRENT VIEW</span></article>
        <article><b>{count.FAILED || 0}</b><span>FAILED</span></article>
        <article><b>{count.WARNING || 0}</b><span>WARNINGS</span></article>
        <article><b>{count.BYPASSED || 0}</b><span>ACCEPTED LAST-GOOD</span></article>
      </div>

      <div className={styles.filters}>
        <label>SEARCH<input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Wiki title or URL" /></label>
        <label>STATUS<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option>ALL</option>{["FAILED", "WARNING", "CURRENT", "UPDATED", "BYPASSED", "DISABLED"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>COURSE<select value={courseId} onChange={(event) => { setCourseId(event.target.value); setPage(1); }}><option value="">ALL COURSES</option>{data?.courses.map((course) => <option value={course.id} key={course.id}>{course.code} · {course.title}</option>)}</select></label>
      </div>

      {message && <p className={styles.message} role="status">{message}</p>}

      <div className={styles.selectionBar}>
        <label className={styles.selectToggle}>
          <input type="checkbox" checked={pageSelected} onChange={togglePage} />
          <span>{pageSelected ? "CLEAR THIS PAGE" : `SELECT THIS PAGE (${pageIds.length})`}</span>
        </label>
        <button className={allIssuesSelected ? styles.selectionActive : ""} onClick={() => { setAllIssuesSelected(true); setSelected([]); }}>
          SELECT ALL ISSUES ({issueCount})
        </button>
        <span>{allIssuesSelected ? `${issueCount} ISSUE SOURCES SELECTED` : `${selected.length} SOURCES SELECTED`}</span>
      </div>

      <div className={styles.bulk}>
        <button disabled={busy || (!selected.length && !allIssuesSelected)} onClick={() => void bulkAction("retry")}>RETRY SELECTED</button>
        <button disabled={busy || (!selected.length && !allIssuesSelected)} onClick={() => void bulkAction("force")}>FORCE UPDATE</button>
        <button disabled={busy || (!selected.length && !allIssuesSelected)} onClick={() => void bulkAction("resolve")}>RESOLVE ELIGIBLE ISSUES</button>
        <button
          disabled={busy || (!selected.length && !allIssuesSelected)}
          onClick={() => {
            const reason = window.prompt("Reason for retaining the verified last-good revisions:");
            if (reason) void bulkAction("acknowledge", reason);
          }}
        >
          ACCEPT LAST-GOOD
        </button>
        <button disabled={busy || issueCount === 0} onClick={() => { setAllIssuesSelected(true); setSelected([]); void bulkAction("resolve", undefined, { scope: "issues" }); }}>
          RESOLVE ALL {issueCount} ISSUES
        </button>
      </div>

      <div className={styles.table}>
        <div className={styles.tableHead}>
          <span>SELECT</span><span>SOURCE</span><span>MAPPED COURSES</span><span>LAST SUCCESS</span><span>STATUS</span>
        </div>
        {data?.items.map((source) => (
          <div className={styles.row} key={source.id}>
            <input
              aria-label={`Select ${source.wikiTitle}`}
              type="checkbox"
              checked={allIssuesSelected ? ["FAILED", "WARNING"].includes(source.syncStatus) : selected.includes(source.id)}
              onChange={(event) => {
                setAllIssuesSelected(false);
                setSelected((current) => event.target.checked ? [...new Set([...current, source.id])] : current.filter((id) => id !== source.id));
              }}
            />
            <button className={styles.sourceOpen} onClick={() => setOpen(source)}>
              <b>{source.wikiTitle}</b>
              <small>{source.lastErrorMessage || source.statusWarnings.join(" · ") || "No active warning"}</small>
            </button>
            <span>{source.mappings.length ? source.mappings.map((mapping) => mapping.course.code).join(", ") : "UNMAPPED"}</span>
            <span>{source.lastSuccessAt ? new Date(source.lastSuccessAt).toLocaleString() : "NEVER"}</span>
            <strong data-status={source.syncStatus}>{source.syncStatus}</strong>
          </div>
        ))}
      </div>

      <nav className={styles.pagination} aria-label="Curriculum source pages">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>← PREVIOUS</button>
        <span>PAGE {data?.page || 1} OF {data?.pages || 1}</span>
        <button disabled={page >= (data?.pages || 1)} onClick={() => setPage(page + 1)}>NEXT →</button>
      </nav>

      {open && (
        <div className={styles.drawerBack} onClick={() => setOpen(null)}>
          <aside className={styles.drawer} onClick={(event) => event.stopPropagation()}>
            <button className={styles.close} onClick={() => setOpen(null)} aria-label="Close source diagnostic">×</button>
            <small>SOURCE DIAGNOSTIC</small>
            <h2>{open.wikiTitle}</h2>
            <a href={open.url} target="_blank" rel="noreferrer">OPEN APPROVED WIKI PAGE ↗</a>
            <div className={styles.diagnostics}>
              <span><small>HTTP</small><b>{open.lastHttpStatus || "—"}</b></span>
              <span><small>FAILURES</small><b>{open.consecutiveFailures}</b></span>
              <span><small>CURRENT REVISION</small><b>{open.revisionId || "—"}</b></span>
              <span><small>LAST GOOD</small><b>{open.lastGoodRevisionId || "—"}</b></span>
            </div>
            <section><small>WHY THIS NEEDS ATTENTION</small><p>{open.lastErrorMessage || open.statusWarnings.join(" · ") || "This source has no active warning."}</p><code>{open.lastErrorCode || open.syncStatus}</code></section>
            <section><small>LAST-GOOD EXCERPT</small><p>{open.sourceExcerpt || "No verified source excerpt is stored yet."}</p></section>
            <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void sourceAction("correct", { wikiTitle: form.get("wikiTitle"), url: form.get("url"), courseIds: form.getAll("courseIds") }); }}>
              <label>WIKI TITLE<input name="wikiTitle" defaultValue={open.wikiTitle} /></label>
              <label>APPROVED BOHEMIA URL<input name="url" defaultValue={open.url} /></label>
              <label>COURSE MAPPINGS<select name="courseIds" multiple defaultValue={open.mappings.map((item) => item.course.id)}>{data?.courses.map((course) => <option value={course.id} key={course.id}>{course.code} · {course.title}</option>)}</select></label>
              <button>SAVE CORRECTION</button>
            </form>
            <div className={styles.actions}>
              <button onClick={() => void bulkAction("retry", undefined, { ids: [open.id] })}>RETRY</button>
              <button onClick={() => void bulkAction("force", undefined, { ids: [open.id] })}>FORCE UPDATE</button>
              <button onClick={() => { const reason = prompt("Required bypass reason"); if (reason) void sourceAction("bypass", { reason }); }}>BYPASS WARNING</button>
              <button onClick={() => { const reason = prompt("Required disable reason"); if (reason) void sourceAction("disable", { reason }); }}>DISABLE SOURCE</button>
            </div>
            <section><small>SYNC HISTORY</small>{open.attempts.map((attempt) => <p key={attempt.id}><b>{attempt.outcome}</b> · {attempt.mode} · {new Date(attempt.startedAt).toLocaleString()}<br />{attempt.errorMessage}</p>)}</section>
          </aside>
        </div>
      )}
    </section>
  );
}
