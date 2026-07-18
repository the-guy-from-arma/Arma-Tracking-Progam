"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./OwnerUniversitySettings.module.css";
import { CampusOperationsPanel } from "./CampusOperationsPanel";

type Application = {
  id: string;
  status: string;
  country: string;
  timeZone: string;
  experienceLevel: string;
  workbenchExperience: string;
  enforceExperience: string;
  weeklyHours: number;
  learningGoals: string;
  fundingStatement: string;
  supportNeeds: string | null;
  submittedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    academicEmail: string | null;
    studentNumber: string | null;
    specialty: string | null;
    grantBalanceCents: number;
    suspended: boolean;
    _count: { courseEnrollments: number; certificates: number };
  };
};
type Ledger = {
  id: string;
  type: string;
  amountCents: number;
  description: string;
  createdAt: string;
  user: { name: string; studentNumber: string | null };
};
type Data = {
  applications: Application[];
  ledger: Ledger[];
  curriculumCoverage: {
    attention: {
      id: string;
      wikiTitle: string;
      url: string;
      syncStatus: string;
      statusWarnings: string[];
      courseId: string | null;
    }[];
    unmapped: number;
    warnings: number;
  };
  summary: {
    students: number;
    availableFundingCents: number;
    submitted: number;
    admitted: number;
    waitlisted: number;
    declined: number;
  };
};
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);

export function OwnerUniversitySettings() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/university");
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Owner settings are unavailable.");
      return;
    }
    setData(result);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function syncWiki() {
    setSyncMessage("SYNCING OFFICIAL SOURCES…");
    const response = await fetch("/api/admin/curriculum/sync", {
      method: "POST",
    });
    const result = await response.json();
    setSyncMessage(
      response.ok
        ? `${result.updated} SOURCES UPDATED · ${result.failed} NEED REVIEW`
        : result.error,
    );
  }
  if (!data)
    return (
      <div className={styles.loading}>
        {error || "LOADING UNIVERSITY ADMINISTRATION…"}
      </div>
    );

  return (
    <section className={styles.settings}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>
            OWNER SETTINGS / UNIVERSITY OPERATIONS
          </p>
          <h1>Admissions and sponsored learning</h1>
        </div>
        <div className={styles.syncPanel}>
          <p>
            Review student records, move applications forward, adjust
            sponsored-learning balances, and preserve a complete financial audit
            trail.
          </p>
          <button onClick={syncWiki}>
            {syncMessage || "SYNC BOHEMIA WIKI SOURCES"}
          </button>
        </div>
      </header>
      <div className={styles.summary}>
        <article>
          <small>ACTIVE STUDENTS</small>
          <strong>{data.summary.students}</strong>
        </article>
        <article>
          <small>ADMITTED APPLICATIONS</small>
          <strong>{data.summary.admitted}</strong>
        </article>
        <article>
          <small>NEEDS DECISION</small>
          <strong>{data.summary.submitted + data.summary.waitlisted}</strong>
        </article>
        <article>
          <small>AVAILABLE GRANT BALANCES</small>
          <strong>{money(data.summary.availableFundingCents)}</strong>
        </article>
      </div>
      <CampusOperationsPanel />
      <GeminiStatus />
      <ValueSchedule />
      <ProgramApplications />
      <section className={styles.section}>
        <header className={styles.sectionHead}>
          <div>
            <span>01 / CONTROL CENTER</span>
            <h2>Student applications</h2>
          </div>
          <p>{data.applications.length} TOTAL RECORDS</p>
        </header>
        <div className={styles.applications}>
          {data.applications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              refresh={load}
            />
          ))}
          {!data.applications.length && (
            <div className={styles.empty}>
              No student applications have been submitted.
            </div>
          )}
        </div>
      </section>
      <section className={styles.section}>
        <header className={styles.sectionHead}>
          <div>
            <span>02 / CURRICULUM COVERAGE</span>
            <h2>Wiki mapping backlog</h2>
          </div>
          <p>
            {data.curriculumCoverage.unmapped} UNMAPPED ·{" "}
            {data.curriculumCoverage.warnings} WARNINGS
          </p>
        </header>
        <div className={styles.ledger}>
          {data.curriculumCoverage.attention.map((source) => (
            <article key={source.id}>
              <div>
                <b>{source.wikiTitle}</b>
                <small>
                  {source.courseId
                    ? "MAPPED SOURCE"
                    : "FACULTY MAPPING REQUIRED"}
                </small>
              </div>
              <span>
                {source.statusWarnings.join(" · ") ||
                  "Discovered during official category inventory"}
              </span>
              <strong data-negative={source.syncStatus === "FAILED"}>
                {source.syncStatus}
              </strong>
            </article>
          ))}
          {!data.curriculumCoverage.attention.length && (
            <div className={styles.empty}>
              Every discovered wiki source is mapped and current.
            </div>
          )}
        </div>
      </section>
      <section className={styles.section}>
        <header className={styles.sectionHead}>
          <div>
            <span>03 / ACCOUNTABILITY</span>
            <h2>Funding ledger</h2>
          </div>
          <p>LAST 50 TRANSACTIONS</p>
        </header>
        <div className={styles.ledger}>
          {data.ledger.map((entry) => (
            <article key={entry.id}>
              <div>
                <b>{entry.user.name}</b>
                <small>
                  {entry.user.studentNumber || "UNASSIGNED"} ·{" "}
                  {entry.type.replaceAll("_", " ")}
                </small>
              </div>
              <span>{entry.description}</span>
              <strong data-negative={entry.amountCents < 0}>
                {entry.amountCents > 0 ? "+" : ""}
                {money(entry.amountCents)}
              </strong>
            </article>
          ))}
          {!data.ledger.length && (
            <div className={styles.empty}>
              No funding activity has been recorded.
            </div>
          )}
        </div>
      </section>
    </section>
  );
}

function GeminiStatus() {
  type AiStatus = {
    model: string;
    enabled: boolean;
    keyConfigured: boolean;
    workerConfigured: boolean;
    connected: boolean | null;
    connectionMessage: string;
    confidenceThreshold: number;
    maxRetries: number;
    ready: boolean;
  };
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const load = useCallback(async (test = false) => {
    setTesting(test);
    const response = await fetch(
      `/api/admin/ai-status${test ? "?test=1" : ""}`,
      { cache: "no-store" },
    );
    const result = await response.json();
    if (response.ok) setStatus(result);
    setTesting(false);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  return (
    <section className={styles.aiStatus}>
      <div
        className={styles.aiOrb}
        data-ready={status?.connected === true || status?.ready}
      >
        <i />
        <b>G</b>
        <span>
          {status?.connected === true
            ? "CONNECTED"
            : status?.ready
              ? "CONFIGURED"
              : "SETUP REQUIRED"}
        </span>
      </div>
      <div>
        <small>GEMINI ASSESSMENT SERVICE</small>
        <h2>{status?.model || "Checking server configuration…"}</h2>
        <p>
          {status?.connectionMessage ||
            "Reading protected Railway variables. The API key is never returned to this page."}
        </p>
        <div className={styles.aiChecks}>
          <span data-on={status?.keyConfigured}>API KEY</span>
          <span data-on={status?.enabled}>GRADING ENABLED</span>
          <span data-on={status?.workerConfigured}>WORKER SECRET</span>
          <span data-on={status?.connected === true}>LIVE TEST</span>
        </div>
      </div>
      <aside>
        <span>
          <small>FINALIZE THRESHOLD</small>
          <b>{Math.round((status?.confidenceThreshold || 0.85) * 100)}%</b>
        </span>
        <span>
          <small>MAX RETRIES</small>
          <b>{status?.maxRetries || 3}</b>
        </span>
        <button
          disabled={testing || !status?.keyConfigured}
          onClick={() => void load(true)}
        >
          {testing ? "TESTING SECURE CONNECTION…" : "TEST GEMINI CONNECTION"}
        </button>
      </aside>
    </section>
  );
}

function ValueSchedule() {
  const [schedule, setSchedule] = useState<{
    name: string;
    hourlyInstructionCents: number;
    labServicesCents: number;
    aiAssessmentCents: number;
    studioServicesCents: number;
    credentialAdminCents: number;
  } | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    void fetch("/api/admin/university/value-schedule")
      .then((response) => response.json())
      .then((result) => setSchedule(result.schedule || null));
  }, []);
  if (!schedule) return null;
  const dollars = (cents: number) => cents / 100;
  return (
    <section className={styles.section}>
      <header className={styles.sectionHead}>
        <div>
          <span>VALUE SCHEDULE</span>
          <h2>Sponsored education valuation</h2>
        </div>
        <p>EFFECTIVE-DATED OWNER CONTROL</p>
      </header>
      <form
        className={styles.rateSchedule}
        onSubmit={async (event) => {
          event.preventDefault();
          setMessage("PUBLISHING…");
          const response = await fetch("/api/admin/university/value-schedule", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(
              Object.fromEntries(new FormData(event.currentTarget)),
            ),
          });
          const result = await response.json();
          if (!response.ok) setMessage(result.error);
          else {
            setSchedule(result.schedule);
            setMessage("SCHEDULE PUBLISHED · ALL 192 COURSES REVALUED");
          }
        }}
      >
        <label>
          SCHEDULE NAME
          <input name="name" defaultValue={schedule.name} />
        </label>
        <label>
          INSTRUCTION / HOUR ($)
          <input
            name="hourlyInstruction"
            type="number"
            min="0"
            step="1"
            defaultValue={dollars(schedule.hourlyInstructionCents)}
          />
        </label>
        <label>
          LAB SERVICES ($)
          <input
            name="labServices"
            type="number"
            min="0"
            step="1"
            defaultValue={dollars(schedule.labServicesCents)}
          />
        </label>
        <label>
          AI ASSESSMENT ($)
          <input
            name="aiAssessment"
            type="number"
            min="0"
            step="1"
            defaultValue={dollars(schedule.aiAssessmentCents)}
          />
        </label>
        <label>
          STUDIO SERVICES ($)
          <input
            name="studioServices"
            type="number"
            min="0"
            step="1"
            defaultValue={dollars(schedule.studioServicesCents)}
          />
        </label>
        <label>
          CREDENTIAL ADMIN ($)
          <input
            name="credentialAdmin"
            type="number"
            min="0"
            step="1"
            defaultValue={dollars(schedule.credentialAdminCents)}
          />
        </label>
        <button>PUBLISH NEW SCHEDULE</button>
        {message && <p>{message}</p>}
      </form>
    </section>
  );
}

function ProgramApplications() {
  type ProgramApplication = {
    id: string;
    statement: string;
    experience: string;
    weeklyHours: number;
    submittedAt: string;
    user: {
      name: string;
      academicEmail: string | null;
      studentNumber: string | null;
    };
    program: { title: string; code: string };
  };
  const [applications, setApplications] = useState<ProgramApplication[]>([]);
  const load = useCallback(async () => {
    const response = await fetch("/api/university/programs");
    const result = await response.json();
    if (response.ok) setApplications(result.pendingApplications || []);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function decide(applicationId: string, status: string) {
    await fetch("/api/university/programs", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicationId, status }),
    });
    await load();
  }
  return (
    <section className={styles.section}>
      <header className={styles.sectionHead}>
        <div>
          <span>PROGRAM ADMISSIONS</span>
          <h2>Pathway applications</h2>
        </div>
        <p>{applications.length} NEED DECISION</p>
      </header>
      <div className={styles.applications}>
        {applications.map((application) => (
          <article className={styles.programApplication} key={application.id}>
            <div>
              <small>
                {application.program.code} ·{" "}
                {application.user.studentNumber || "STUDENT"}
              </small>
              <h3>{application.user.name}</h3>
              <b>{application.program.title}</b>
              <p>{application.statement}</p>
              <span>
                {application.experience} · {application.weeklyHours} hours/week
              </span>
            </div>
            <aside>
              <button onClick={() => decide(application.id, "DECLINED")}>
                DECLINE
              </button>
              <button onClick={() => decide(application.id, "WAITLISTED")}>
                WAITLIST
              </button>
              <button onClick={() => decide(application.id, "ADMITTED")}>
                ADMIT + ACTIVATE
              </button>
            </aside>
          </article>
        ))}
        {!applications.length && (
          <div className={styles.empty}>
            Every program application has a decision.
          </div>
        )}
      </div>
    </section>
  );
}

function ApplicationCard({
  application,
  refresh,
}: {
  application: Application;
  refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/university", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicationId: application.id, ...payload }),
    });
    const result = await response.json();
    if (!response.ok)
      setMessage(result.error || "The action could not be completed.");
    else {
      setAmount("");
      setNote("");
      await refresh();
    }
    setBusy(false);
  }
  return (
    <details className={styles.application}>
      <summary>
        <div className={styles.student}>
          <strong>{application.user.name}</strong>
          <span>
            {application.user.academicEmail || application.user.email}
          </span>
        </div>
        <div className={styles.meta}>
          <b>{application.user.studentNumber || "ID PENDING"}</b>
          <span>
            {application.user.specialty || application.experienceLevel}
          </span>
        </div>
        <div className={styles.balance}>
          <small>AVAILABLE BALANCE</small>
          <b>{money(application.user.grantBalanceCents)}</b>
        </div>
        <span className={styles.status} data-status={application.status}>
          {application.status}
        </span>
      </summary>
      <div className={styles.body}>
        <div className={styles.profile}>
          <div>
            <small>LOCATION</small>
            <b>
              {application.country} / {application.timeZone}
            </b>
          </div>
          <div>
            <small>WEEKLY HOURS</small>
            <b>{application.weeklyHours}</b>
          </div>
          <div>
            <small>ACADEMIC ACTIVITY</small>
            <b>
              {application.user._count.courseEnrollments} courses ·{" "}
              {application.user._count.certificates} credentials
            </b>
          </div>
          <div className={styles.statement}>
            <small>LEARNING GOALS</small>
            <p>{application.learningGoals}</p>
          </div>
          <div className={styles.statement}>
            <small>FUNDING STATEMENT</small>
            <p>{application.fundingStatement}</p>
          </div>
          {application.supportNeeds && (
            <div className={styles.statement}>
              <small>SUPPORT NEEDS</small>
              <p>{application.supportNeeds}</p>
            </div>
          )}
        </div>
        <aside className={styles.controls}>
          <h3>APPLICATION DECISION</h3>
          <div className={styles.decisions}>
            <button
              disabled={busy}
              onClick={() =>
                act({ action: "set_status", status: "ADMITTED", note })
              }
            >
              ADMIT
            </button>
            <button
              disabled={busy}
              onClick={() =>
                act({ action: "set_status", status: "WAITLISTED", note })
              }
            >
              WAITLIST
            </button>
            <button
              disabled={busy}
              onClick={() =>
                act({ action: "set_status", status: "DECLINED", note })
              }
            >
              DECLINE
            </button>
          </div>
          <h3>SPONSORED FUNDING</h3>
          <div className={styles.funding}>
            <label>
              ADJUSTMENT ($)
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                type="number"
                step="1"
                placeholder="25000 or -500"
              />
            </label>
            <label className={styles.wide}>
              AUDIT REASON
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Supplemental pathway award"
              />
            </label>
            <button
              disabled={busy || !amount || note.length < 5}
              onClick={() =>
                act({ action: "adjust_funding", amountDollars: amount, note })
              }
            >
              {busy ? "PROCESSING…" : "POST FUNDING ADJUSTMENT"}
            </button>
          </div>
          {message && <p className={styles.message}>{message}</p>}
        </aside>
      </div>
    </details>
  );
}
