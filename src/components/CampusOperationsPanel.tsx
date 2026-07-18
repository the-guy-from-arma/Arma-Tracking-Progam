"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./CampusOperationsPanel.module.css";

type OperationsData = {
  status: { admissionsMode: string; enrollmentMode: string; learningMode: string; publicTitle: string; publicMessage: string; reopensAt: string | null };
  periods: { id: string; title: string; status: string; startsAt: string; endsAt: string; learningMode: string }[];
  impact: { activeEnrollments: number; pendingApplications: number };
};
type AdmissionsData = {
  worker: { enabled: boolean; mode: string; model: string; keyConfigured: boolean; secretConfigured: boolean; queued: number; processing: number; exceptions: number; stale: number };
  applications: { id: string; status: string; submittedAt: string; user: { name: string; email: string }; trackingRecords: { trackingNumber: string }[]; reviewJobs: { status: string; attempt: number; lastError?: string; decision?: { outcome: string; score: number; confidence: number; concerns: string[] } }[] }[];
};

const templates = {
  SPRING_RECESS: { title: "Spring recess", message: "Campus learning is taking a short spring recess. Records, policies, lessons, and advising remain available while academic submissions pause.", learningMode: "ACADEMIC_BREAK" },
  SUMMER_SESSION: { title: "Summer session transition", message: "The university is preparing the next summer learning session. Academic work will resume at the published reopening time.", learningMode: "ACADEMIC_BREAK" },
  WINTER_RECESS: { title: "Winter recess", message: "Campus learning is on winter recess. Your academic record and support network remain available.", learningMode: "ACADEMIC_BREAK" },
  SEMESTER_TRANSITION: { title: "Semester transition", message: "The campus is between academic sessions while schedules and learning records are prepared.", learningMode: "ACADEMIC_BREAK" },
  MAINTENANCE: { title: "Campus maintenance", message: "Academic services are temporarily paused for planned campus maintenance.", learningMode: "MAINTENANCE" },
  EMERGENCY: { title: "Campus temporarily closed", message: "Academic activity is temporarily unavailable. Policies, records, closure information, and support remain accessible.", learningMode: "EMERGENCY_CLOSURE" },
} as const;

export function CampusOperationsPanel() {
  const [operations, setOperations] = useState<OperationsData | null>(null);
  const [admissions, setAdmissions] = useState<AdmissionsData | null>(null);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const [operationsResponse, admissionsResponse] = await Promise.all([fetch("/api/admin/university/operations", { cache: "no-store" }), fetch("/api/admin/university/admissions", { cache: "no-store" })]);
    const [operationsResult, admissionsResult] = await Promise.all([operationsResponse.json(), admissionsResponse.json()]);
    if (operationsResponse.ok) setOperations(operationsResult);
    if (admissionsResponse.ok) setAdmissions(admissionsResult);
  }, []);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);

  async function schedule(formData: FormData) {
    setMessage("SAVING OPERATING PERIOD…");
    const season = String(formData.get("season") || "SPRING_RECESS") as keyof typeof templates;
    const preset = templates[season];
    const response = await fetch("/api/admin/university/operations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: formData.get("action"), title: formData.get("title") || preset.title, publicMessage: formData.get("publicMessage") || preset.message, ownerNote: formData.get("ownerNote"), admissionsMode: formData.get("admissionsMode"), enrollmentMode: formData.get("enrollmentMode"), learningMode: formData.get("learningMode"), season, startsAt: formData.get("startsAt"), endsAt: formData.get("endsAt") }) });
    const result = await response.json();
    setMessage(response.ok ? "CAMPUS OPERATING PERIOD SAVED" : result.error || "OPERATING PERIOD COULD NOT BE SAVED");
    if (response.ok) await load();
  }

  async function reopen() {
    const response = await fetch("/api/admin/university/operations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reopen", reason: "Owner reopened campus services." }) });
    setMessage(response.ok ? "CAMPUS REOPENED" : "CAMPUS COULD NOT BE REOPENED");
    if (response.ok) await load();
  }

  async function cancelPeriod(periodId: string) {
    const response = await fetch("/api/admin/university/operations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "cancel", periodId, reason: "Cancelled from Owner Academic Operations." }) });
    const result = await response.json();
    setMessage(response.ok ? "SCHEDULED PERIOD CANCELLED" : result.error || "PERIOD COULD NOT BE CANCELLED");
    if (response.ok) await load();
  }

  async function admissionAction(applicationId: string, action: string) {
    const note = action === "admit" || action === "decline" ? window.prompt("Record the owner decision reason:") : "Owner requested a safe retry.";
    if ((action === "admit" || action === "decline") && !note) return;
    const response = await fetch("/api/admin/university/admissions", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ applicationId, action, note }) });
    const result = await response.json();
    setMessage(response.ok ? `APPLICATION ${action.toUpperCase()} COMPLETED` : result.error || "APPLICATION ACTION FAILED");
    if (response.ok) await load();
  }

  return <section className={styles.panel}>
    <header><div><span>ACADEMIC OPERATIONS</span><h2>Campus calendar and automated admissions</h2></div><p>{message || "Control availability without losing student work or records."}</p></header>
    <div className={styles.statusGrid}>
      <article><small>LEARNING CAMPUS</small><strong>{operations?.status.learningMode.replaceAll("_", " ") || "LOADING"}</strong><span>{operations?.status.publicTitle}</span></article>
      <article><small>ADMISSIONS</small><strong>{operations?.status.admissionsMode || "—"}</strong><span>{operations?.impact.pendingApplications || 0} active application records</span></article>
      <article><small>NEW ENROLLMENT</small><strong>{operations?.status.enrollmentMode || "—"}</strong><span>{operations?.impact.activeEnrollments || 0} active course enrollments</span></article>
      <article><small>AUTOMATION WORKER</small><strong>{admissions?.worker.enabled ? admissions.worker.mode : "DISABLED"}</strong><span>{admissions?.worker.model || "Model not reported"}</span></article>
    </div>
    <div className={styles.operationsBody}>
      <form action={schedule} className={styles.scheduler}>
        <div><span>SCHEDULE CAMPUS PERIOD</span><h3>Create a recess or closure</h3></div>
        <label>Presentation<select name="season" defaultValue="SPRING_RECESS">{Object.keys(templates).map((template) => <option key={template}>{template.replaceAll("_", " ")}</option>)}</select></label>
        <label>Admissions<select name="admissionsMode" defaultValue="OPEN"><option>OPEN</option><option>PAUSED</option></select></label>
        <label>New enrollment<select name="enrollmentMode" defaultValue="PAUSED"><option>OPEN</option><option>PAUSED</option></select></label>
        <label>Learning campus<select name="learningMode" defaultValue="ACADEMIC_BREAK"><option>ACTIVE</option><option>ACADEMIC_BREAK</option><option>MAINTENANCE</option><option>EMERGENCY_CLOSURE</option></select></label>
        <label>Public title<input name="title" placeholder="Uses the selected template when empty" /></label>
        <label className={styles.wide}>Public explanation<textarea name="publicMessage" placeholder="Uses the selected template when empty" /></label>
        <label>Starts<input name="startsAt" type="datetime-local" required /></label>
        <label>Reopens<input name="endsAt" type="datetime-local" required /></label>
        <label className={styles.wide}>Private owner note<textarea name="ownerNote" /></label>
        <div className={styles.actions}><button name="action" value="schedule">SCHEDULE PERIOD</button><button name="action" value="start_now">START NOW</button>{operations?.status.learningMode !== "ACTIVE" && <button type="button" onClick={reopen}>REOPEN CAMPUS</button>}</div>
        {!!operations?.periods.length && <div className={styles.periods}>{operations.periods.slice(0, 6).map((period) => <div key={period.id}><span><b>{period.title}</b>{new Date(period.startsAt).toLocaleString()} — {new Date(period.endsAt).toLocaleString()}</span><em>{period.status}</em>{period.status === "SCHEDULED" && <button type="button" onClick={() => void cancelPeriod(period.id)}>CANCEL</button>}</div>)}</div>}
      </form>
      <section className={styles.queue}><header><span>ADMISSIONS QUEUE</span><b>{admissions?.applications.length || 0} ACTIVE</b></header>{admissions?.applications.slice(0, 12).map((application) => { const job = application.reviewJobs[0]; return <article key={application.id}><div><small>{application.trackingRecords[0]?.trackingNumber || application.id}</small><strong>{application.user.name}</strong><span>{application.status.replaceAll("_", " ")} · {job?.decision ? `${job.decision.outcome} / ${job.decision.score} / ${Math.round(job.decision.confidence * 100)}%` : job?.status || "QUEUED"}</span>{job?.decision?.concerns?.length ? <p>{job.decision.concerns.join(" · ")}</p> : null}</div><nav><button onClick={() => void admissionAction(application.id, "retry")}>RETRY</button><button onClick={() => void admissionAction(application.id, "admit")}>ADMIT</button><button onClick={() => void admissionAction(application.id, "decline")}>DECLINE</button></nav></article>})}<footer>Worker: {admissions?.worker.queued || 0} queued · {admissions?.worker.processing || 0} processing · {admissions?.worker.exceptions || 0} exceptions · {admissions?.worker.stale || 0} stale</footer></section>
    </div>
  </section>;
}
