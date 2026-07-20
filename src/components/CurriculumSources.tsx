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
  snapshots: { id: string; revisionId: string; capturedAt: string; contentChecksum: string; _count: { media: number } }[];
};

type Data = {
  items: Source[];
  total: number;
  page: number;
  pages: number;
  counts: { syncStatus: string; _count: number }[];
  courses: { id: string; code: string; title: string }[];
};

type CompileData = {
  enabled: boolean;
  autoPublish: boolean;
  threshold: number;
  courses: { id: string; code: string; title: string; academy: string; _count: { days: number } }[];
  jobs: { id: string; status: string; confidence: number | null; lastError: string | null; createdAt: string; hasPreview: boolean; previewPayload?: { days?: { dayNumber: number; title: string; confidence: number; blocks: { type: string; title: string }[] }[] } | null; validationResult: { errors?: string[]; highestSimilarity?: number }; sourceRevisionIds: string[]; course: { code: string; title: string; academy: string } }[];
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
  const [compileData, setCompileData] = useState<CompileData | null>(null);
  const [compileCourse, setCompileCourse] = useState("");
  const [compileAcademy, setCompileAcademy] = useState("");
  const [previewJob, setPreviewJob] = useState<CompileData["jobs"][number] | null>(null);

  const load = useCallback(async () => {
    const query = new URLSearchParams({ page: String(page), search, status, courseId });
    const [response, compileResponse] = await Promise.all([fetch(`/api/admin/curriculum/sources?${query}`, { cache: "no-store" }), fetch("/api/admin/curriculum/compile", { cache: "no-store" })]);
    const [result, compileResult] = await Promise.all([response.json(), compileResponse.json()]);
    if (response.ok) setData(result);
    else setMessage(result.error || "Curriculum sources could not be loaded.");
    if (compileResponse.ok) setCompileData(compileResult);
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
  const selectedMappedCourses = [...new Set((data?.items || []).filter((source) => selected.includes(source.id)).flatMap((source) => source.mappings.map((mapping) => mapping.course.id)))];

  function selectionPayload() {
    return allIssuesSelected
      ? { scope: "issues" }
      : { ids: selected };
  }

  async function compile(action: "queue" | "publish" | "reject" | "rollback", payload: Record<string, unknown>) {
    setBusy(true); setMessage(action === "queue" ? "Adding complete courses to the Guided Studio compilation queue…" : "Applying the curriculum decision…");
    try {
      const response = await fetch("/api/admin/curriculum/compile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      const result = await response.json().catch(() => ({}));
      setMessage(response.ok ? action === "queue" ? `${result.queued} course${result.queued === 1 ? "" : "s"} queued for source-grounded compilation.` : `Curriculum ${action} completed.` : result.error || "The curriculum action could not be completed.");
      if (response.ok) await load();
    } finally { setBusy(false); }
  }
  async function openCompilePreview(jobId: string) {
    const response = await fetch(`/api/admin/curriculum/compile?jobId=${encodeURIComponent(jobId)}`, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (response.ok) setPreviewJob({ ...result.job, hasPreview: true });
    else setMessage(result.error || "Compilation preview could not be loaded.");
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

      <section className={styles.compilerPanel}>
        <header><div><small>GUIDED COURSE STUDIO / COMPILER</small><h2>Source-grounded course publishing</h2><p>Compile complete courses from verified Wiki snapshots. Student lessons change only after every day passes structure, citation, media, duplication, and confidence validation.</p></div><span data-enabled={compileData?.enabled}>{compileData?.enabled ? "WORKER ENABLED" : "WORKER DISABLED"}<b>{compileData?.autoPublish ? `AUTO-PUBLISH ≥ ${Math.round((compileData?.threshold || 0.9) * 100)}%` : "OWNER PUBLISH"}</b></span></header>
        <div className={styles.compilerControls}>
          <label>COURSE<select value={compileCourse} onChange={(event) => setCompileCourse(event.target.value)}><option value="">Select one course</option>{compileData?.courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label>
          <button disabled={busy || !compileCourse} onClick={() => void compile("queue", { courseIds: [compileCourse] })}>COMPILE COURSE</button>
          <label>ACADEMY<select value={compileAcademy} onChange={(event) => setCompileAcademy(event.target.value)}><option value="">Select academy</option>{[...new Set(compileData?.courses.map((course) => course.academy) || [])].map((academy) => <option key={academy}>{academy}</option>)}</select></label>
          <button disabled={busy || !compileAcademy} onClick={() => void compile("queue", { academy: compileAcademy })}>COMPILE ACADEMY</button>
          <button disabled={busy || !selectedMappedCourses.length} onClick={() => void compile("queue", { courseIds: selectedMappedCourses })}>COMPILE SELECTED ({selectedMappedCourses.length})</button>
          <button disabled={busy} onClick={() => { if (confirm("Queue every published course for compilation? Existing lessons remain live until replacements validate.")) void compile("queue", { scope: "ALL" }); }}>COMPILE ALL 192</button>
        </div>
        <div className={styles.compilerJobs}>{compileData?.jobs.slice(0, 8).map((job) => <article key={job.id}><div><b>{job.course.code} · {job.course.title}</b><small>{job.course.academy} · {new Date(job.createdAt).toLocaleString()}</small></div><strong data-status={job.status}>{job.status}{job.confidence == null ? "" : ` · ${Math.round(job.confidence * 100)}%`}</strong>{job.lastError && <p>{job.lastError}</p>}<span>{job.hasPreview && <button onClick={() => void openCompilePreview(job.id)}>PREVIEW</button>}{job.status === "VALIDATED" && <><button onClick={() => void compile("publish", { jobId: job.id })}>PUBLISH</button><button onClick={() => { const reason = prompt("Why is this validated compilation being rejected?"); if (reason) void compile("reject", { jobId: job.id, reason }); }}>REJECT</button></>} {job.status === "PUBLISHED" && <button onClick={() => { const course = compileData.courses.find((item) => item.code === job.course.code); if (course && confirm(`Roll back every lesson in ${job.course.code} to its prior complete version?`)) void compile("rollback", { courseId: course.id }); }}>ROLL BACK</button>}</span></article>)}</div>
      </section>

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
            {open.snapshots[0] && <section><small>STRUCTURED SNAPSHOT · {open.snapshots[0]._count.media} WIKI MEDIA ASSETS</small><p>Revision {open.snapshots[0].revisionId} · captured {new Date(open.snapshots[0].capturedAt).toLocaleString()} · checksum {open.snapshots[0].contentChecksum.slice(0, 16)}…</p></section>}
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
      {previewJob && <div className={styles.drawerBack} onClick={() => setPreviewJob(null)}><aside className={styles.drawer} onClick={(event) => event.stopPropagation()}><button className={styles.close} onClick={() => setPreviewJob(null)} aria-label="Close compilation preview">×</button><small>COMPILATION PREVIEW</small><h2>{previewJob.course.code} · {previewJob.course.title}</h2><p>{previewJob.status} · {previewJob.confidence == null ? "confidence pending" : `${Math.round(previewJob.confidence * 100)}% confidence`} · similarity {Math.round((previewJob.validationResult.highestSimilarity || 0) * 100)}%</p><section><small>SOURCE REVISIONS</small><p>{previewJob.sourceRevisionIds.join(" · ") || "No source revisions recorded."}</p></section>{previewJob.validationResult.errors?.length ? <section><small>VALIDATION EXCEPTIONS</small><ul>{previewJob.validationResult.errors.map((error) => <li key={error}>{error}</li>)}</ul></section> : null}<section><small>COMPLETE DAY-BY-DAY PREVIEW</small>{previewJob.previewPayload?.days?.map((day) => <article className={styles.previewDay} key={day.dayNumber}><b>DAY {day.dayNumber} · {day.title}</b><span>{Math.round(day.confidence * 100)}% confidence</span><p>{day.blocks.map((block) => block.type.replaceAll("_", " ")).join(" · ")}</p></article>)}</section>{previewJob.status === "VALIDATED" && <div className={styles.actions}><button onClick={() => void compile("publish", { jobId: previewJob.id })}>PUBLISH COMPLETE COURSE</button><button onClick={() => { const reason = prompt("Why is this compilation being rejected?"); if (reason) void compile("reject", { jobId: previewJob.id, reason }); }}>REJECT</button></div>}</aside></div>}
    </section>
  );
}
