"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./CampusOperationsPanel.module.css";

type OperationsData = {
  status: {
    admissionsMode: string;
    enrollmentMode: string;
    learningMode: string;
    publicTitle: string;
    publicMessage: string;
    reopensAt: string | null;
  };
  periods: {
    id: string;
    title: string;
    status: string;
    startsAt: string;
    endsAt: string;
    learningMode: string;
    ownerNote: string | null;
  }[];
  impact: { activeEnrollments: number; pendingApplications: number };
};
type OperatingPeriod = OperationsData["periods"][number];
type AdmissionsData = {
  worker: {
    enabled: boolean;
    engine: string;
    secretConfigured: boolean;
    queued: number;
    processing: number;
    exceptions: number;
    stale: number;
  };
  applications: {
    id: string;
    status: string;
    submittedAt: string;
    user: { name: string; email: string };
    trackingRecords: { trackingNumber: string }[];
    reviewJobs: {
      status: string;
      attempt: number;
      lastError?: string;
      decision?: {
        outcome: string;
        score: number;
        confidence: number;
        concerns: string[];
      };
    }[];
  }[];
};

const campusModes = [
  {
    value: "ACTIVE",
    title: "Campus active",
    detail: "Learning, submissions, grading, credentials, and support operate normally.",
    publicTitle: "Campus is open",
    publicMessage: "Admissions, enrollment, and learning services are available.",
  },
  {
    value: "ACADEMIC_BREAK",
    title: "Academic vacation",
    detail: "Lessons remain readable while progress, quizzes, submissions, grading, and credentials pause.",
    publicTitle: "Academic vacation in progress",
    publicMessage: "Campus learning is on academic vacation. Records, policies, lesson reading, advising, and messages remain available.",
  },
  {
    value: "MAINTENANCE",
    title: "Maintenance lock",
    detail: "Academic activity is paused while records, policies, and support remain available.",
    publicTitle: "Campus maintenance",
    publicMessage: "Academic services are temporarily paused for campus maintenance. Records, policies, and support remain available.",
  },
  {
    value: "EMERGENCY_CLOSURE",
    title: "Emergency closure",
    detail: "The strongest restriction. Only closure information, protected records, policies, and essential support remain.",
    publicTitle: "Campus temporarily closed",
    publicMessage: "Academic activity is temporarily unavailable. Closure information, protected records, policies, and essential support remain accessible.",
  },
] as const;

export function CampusOperationsPanel() {
  const [operations, setOperations] = useState<OperationsData | null>(null);
  const [admissions, setAdmissions] = useState<AdmissionsData | null>(null);
  const [message, setMessage] = useState("");
  const [admissionsPaused, setAdmissionsPaused] = useState(false);
  const [enrollmentPaused, setEnrollmentPaused] = useState(false);
  const [learningMode, setLearningMode] = useState("ACTIVE");
  const [publicTitle, setPublicTitle] = useState("Campus is open");
  const [publicMessage, setPublicMessage] = useState(
    "Admissions, enrollment, and learning services are available.",
  );
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [operationsResponse, admissionsResponse] = await Promise.all([
        fetch("/api/admin/university/operations", {
          cache: "no-store",
          signal: AbortSignal.timeout(12_000),
        }),
        fetch("/api/admin/university/admissions", {
          cache: "no-store",
          signal: AbortSignal.timeout(12_000),
        }),
      ]);
      const [operationsResult, admissionsResult] = await Promise.all([
        operationsResponse.json(),
        admissionsResponse.json(),
      ]);
      if (operationsResponse.ok) {
        setOperations(operationsResult);
        setAdmissionsPaused(operationsResult.status.admissionsMode === "PAUSED");
        setEnrollmentPaused(operationsResult.status.enrollmentMode === "PAUSED");
        setLearningMode(operationsResult.status.learningMode);
        setPublicTitle(operationsResult.status.publicTitle);
        setPublicMessage(operationsResult.status.publicMessage);
      } else setMessage(operationsResult.error || "CAMPUS OPERATIONS COULD NOT BE LOADED");
      if (admissionsResponse.ok) setAdmissions(admissionsResult);
    } catch {
      setMessage("CAMPUS OPERATIONS COULD NOT BE LOADED. RETRY THIS PANEL.");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  function chooseMode(value: string) {
    const mode = campusModes.find((item) => item.value === value) || campusModes[0];
    setLearningMode(mode.value);
    setPublicTitle(mode.publicTitle);
    setPublicMessage(mode.publicMessage);
    if (mode.value !== "ACTIVE") setEnrollmentPaused(true);
  }

  async function applySettings(overrides?: {
    admissionsPaused: boolean;
    enrollmentPaused: boolean;
    learningMode: string;
    publicTitle: string;
    publicMessage: string;
  }) {
    if (saving) return;
    const next = overrides || {
      admissionsPaused,
      enrollmentPaused,
      learningMode,
      publicTitle,
      publicMessage,
    };
    setSaving(true);
    setMessage("APPLYING CAMPUS SETTINGS…");
    try {
      const response = await fetch("/api/admin/university/operations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "set_controls",
          admissionsPaused: next.admissionsPaused,
          enrollmentPaused: next.enrollmentPaused,
          learningMode: next.learningMode,
          title: next.publicTitle,
          publicMessage: next.publicMessage,
          reason: "Owner applied immediate campus operating settings.",
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const result = await response.json();
      setMessage(
        response.ok
          ? `SETTINGS ACTIVE · ${result.status.learningMode.replaceAll("_", " ")} · ADMISSIONS ${result.status.admissionsMode} · ENROLLMENT ${result.status.enrollmentMode}`
          : result.error || "CAMPUS SETTINGS COULD NOT BE APPLIED",
      );
      if (response.ok) await load();
    } catch {
      setMessage("THE SETTINGS REQUEST DID NOT COMPLETE. REFRESH STATUS BEFORE RETRYING.");
    } finally {
      setSaving(false);
    }
  }

  async function removePeriod(period: OperatingPeriod) {
    const reason = window.prompt(
      period.status === "ACTIVE"
        ? "Record why this active period should end now:"
        : "Record why this old scheduled period should be cancelled:",
      period.status === "ACTIVE"
        ? "Owner ended this campus period early."
        : "Owner cancelled this scheduled campus period.",
    );
    if (!reason) return;
    try {
      const response = await fetch("/api/admin/university/operations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "remove", periodId: period.id, reason }),
        signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json();
      setMessage(
        response.ok
          ? `OPERATING PERIOD ${result.outcome || "REMOVED"}`
          : result.error || "PERIOD COULD NOT BE REMOVED",
      );
      if (response.ok) await load();
    } catch {
      setMessage("THE PERIOD CHANGE DID NOT COMPLETE. RETRY SAFELY.");
    }
  }

  async function admissionAction(applicationId: string, action: string) {
    const note =
      action === "admit" || action === "decline"
        ? window.prompt("Record the owner decision reason:")
        : "Owner requested a safe retry.";
    if ((action === "admit" || action === "decline") && !note) return;
    const response = await fetch("/api/admin/university/admissions", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicationId, action, note }),
    });
    const result = await response.json();
    setMessage(
      response.ok
        ? `APPLICATION ${action.toUpperCase()} COMPLETED`
        : result.error || "APPLICATION ACTION FAILED",
    );
    if (response.ok) await load();
  }

  const allOpen =
    learningMode === "ACTIVE" && !admissionsPaused && !enrollmentPaused;

  return (
    <section className={styles.panel}>
      <header>
        <div>
          <span>ACADEMIC OPERATIONS</span>
          <h2>Immediate campus controls</h2>
        </div>
        <p role="status" aria-live="polite">
          {message || "Check the restrictions to apply. Settings remain active until the owner changes them."}
        </p>
      </header>

      <div className={styles.statusGrid}>
        <article><small>LEARNING CAMPUS</small><strong>{operations?.status.learningMode.replaceAll("_", " ") || "LOADING"}</strong><span>{operations?.status.publicTitle}</span></article>
        <article><small>ADMISSIONS</small><strong>{operations?.status.admissionsMode || "—"}</strong><span>{operations?.impact.pendingApplications || 0} active application records</span></article>
        <article><small>NEW ENROLLMENT</small><strong>{operations?.status.enrollmentMode || "—"}</strong><span>{operations?.impact.activeEnrollments || 0} active course enrollments</span></article>
        <article><small>ADMISSIONS ENGINE</small><strong>{admissions?.worker.enabled ? "ACTIVE" : "DISABLED"}</strong><span>{admissions?.worker.engine || "Deterministic review"}</span></article>
      </div>

      <div className={styles.operationsBody}>
        <section className={styles.settings}>
          <div className={styles.controlIntro}>
            <span>OWNER SETTINGS</span>
            <h3>Choose what is available now</h3>
            <p>No dates are required. The selected state takes effect immediately and remains until changed.</p>
          </div>

          <div className={styles.toggleGrid}>
            <label className={styles.toggleCard}>
              <input type="checkbox" checked={admissionsPaused} onChange={(event) => setAdmissionsPaused(event.target.checked)} />
              <span><b>Pause admissions</b><small>Blocks final application submission while preserving drafts and tracking.</small></span>
            </label>
            <label className={styles.toggleCard}>
              <input type="checkbox" checked={enrollmentPaused} onChange={(event) => setEnrollmentPaused(event.target.checked)} />
              <span><b>Pause new enrollment</b><small>Prevents new course and program enrollment without altering active records.</small></span>
            </label>
          </div>

          <fieldset className={styles.modeFieldset}>
            <legend>Campus learning state</legend>
            <div className={styles.modeGrid}>
              {campusModes.map((mode) => (
                <label key={mode.value} className={learningMode === mode.value ? styles.activeMode : styles.modeCard}>
                  <input type="radio" name="immediateLearningMode" value={mode.value} checked={learningMode === mode.value} onChange={() => chooseMode(mode.value)} />
                  <span><b>{mode.title}</b><small>{mode.detail}</small></span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className={styles.messageFields}>
            <label>Public status title<input value={publicTitle} onChange={(event) => setPublicTitle(event.target.value)} maxLength={120} /></label>
            <label>Student-facing explanation<textarea value={publicMessage} onChange={(event) => setPublicMessage(event.target.value)} maxLength={600} /></label>
          </div>

          <div className={styles.controlSummary}>
            <b>{allOpen ? "ALL SERVICES OPEN" : "RESTRICTIONS READY"}</b>
            <span>Admissions {admissionsPaused ? "paused" : "open"} · Enrollment {enrollmentPaused ? "paused" : "open"} · Learning {learningMode.replaceAll("_", " ").toLowerCase()}</span>
          </div>

          <div className={styles.actions}>
            <button type="button" disabled={saving} onClick={() => void applySettings()}>{saving ? "APPLYING…" : "APPLY CAMPUS SETTINGS"}</button>
            {!allOpen && <button type="button" disabled={saving} onClick={() => void applySettings({ admissionsPaused: false, enrollmentPaused: false, learningMode: "ACTIVE", publicTitle: campusModes[0].publicTitle, publicMessage: campusModes[0].publicMessage })}>RESTORE ALL SERVICES</button>}
            <button type="button" onClick={() => void load()}>REFRESH STATUS</button>
          </div>

          {!!operations?.periods.length && (
            <div className={styles.periods}>
              <header><b>Operating history</b><span>Prior scheduled records remain auditable.</span></header>
              {operations.periods.slice(0, 12).map((period) => (
                <div key={period.id}>
                  <span><b>{period.title}</b>{new Date(period.startsAt).toLocaleString()} — {period.ownerNote === "MANUAL_OWNER_CONTROL" && period.status === "ACTIVE" ? "until changed by owner" : new Date(period.endsAt).toLocaleString()}</span>
                  <em>{period.status}</em>
                  {["SCHEDULED", "ACTIVE"].includes(period.status) && <button type="button" onClick={() => void removePeriod(period)}>{period.status === "ACTIVE" ? "END NOW" : "CANCEL"}</button>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.queue}>
          <header><span>ADMISSIONS QUEUE</span><b>{admissions?.applications.length || 0} ACTIVE</b></header>
          {admissions?.applications.slice(0, 12).map((application) => {
            const job = application.reviewJobs[0];
            return (
              <article key={application.id}>
                <div>
                  <small>{application.trackingRecords[0]?.trackingNumber || application.id}</small>
                  <strong>{application.user.name}</strong>
                  <span>{application.status.replaceAll("_", " ")} · {job?.decision ? job.decision.outcome : job?.status || "QUEUED"}</span>
                  {job?.decision?.concerns?.length ? <p>{job.decision.concerns.join(" · ")}</p> : null}
                </div>
                <nav>
                  <button onClick={() => void admissionAction(application.id, "retry")}>RETRY</button>
                  <button onClick={() => void admissionAction(application.id, "admit")}>ADMIT</button>
                  <button onClick={() => void admissionAction(application.id, "decline")}>DECLINE</button>
                </nav>
              </article>
            );
          })}
          <footer>Worker: {admissions?.worker.queued || 0} queued · {admissions?.worker.processing || 0} processing · {admissions?.worker.exceptions || 0} exceptions · {admissions?.worker.stale || 0} stale</footer>
        </section>
      </div>
    </section>
  );
}
