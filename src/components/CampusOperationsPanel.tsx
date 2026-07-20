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
    campusBannerEnabled: boolean;
    campusBannerTitle: string;
    campusBannerMessage: string;
    campusBannerPreset: string | null;
    campusBannerTone: string;
    hiddenNavigationViews: string[];
    courseSelectionEnabled: boolean;
    programSelectionEnabled: boolean;
    experienceUpdatedAt: string;
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
    guardianConsent?: {
      status: string;
      guardianName: string;
      alternativeReason?: string | null;
    } | null;
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

const bannerPresets = [
  { id: "CUSTOM", label: "Custom announcement", tone: "INSTITUTIONAL", title: "", message: "" },
  { id: "CAMPUS_BUILDING", label: "Campus development update", tone: "IMPORTANT", title: "Our university is growing", message: "Enscript University is actively expanding its courses, programs, faculty services, and campus tools. Some areas may open in stages. Thank you for being part of our founding student community." },
  { id: "SEMESTER_START", label: "Semester beginning", tone: "CELEBRATION", title: "A new semester begins", message: "Welcome to a new Enscript University semester. Review your academic plan, confirm your current courses, and visit Campus Messages if you need guidance from your advisor or faculty." },
  { id: "SPRING_RECESS", label: "Spring recess", tone: "SEASONAL", title: "Spring recess at Enscript University", message: "We hope you enjoy a restorative spring recess. Campus records and support remain available; review the campus status notice for any temporary learning restrictions." },
  { id: "SUMMER_SESSION", label: "Summer session", tone: "SEASONAL", title: "Summer learning is underway", message: "The Enscript University summer session is open. Keep your study plan focused, check upcoming milestones, and contact your advisor whenever you need help planning the next step." },
  { id: "FALL_WELCOME", label: "Fall semester welcome", tone: "CELEBRATION", title: "Welcome to the fall semester", message: "A new fall semester is beginning at Enscript University. Explore campus, reconnect with faculty, and review your academic plan before selecting your next learning experience." },
  { id: "THANKSGIVING", label: "Thanksgiving message", tone: "SEASONAL", title: "A message of gratitude", message: "Enscript University is grateful for the creativity, discipline, and curiosity of our student community. We hope you have a safe and restorative Thanksgiving season." },
  { id: "WINTER_RECESS", label: "Winter recess", tone: "SEASONAL", title: "Winter recess notice", message: "Enscript University wishes you a safe and restful winter recess. Campus records, policies, and support remain available while regular academic activity may be limited." },
  { id: "HOLIDAY", label: "General holiday greeting", tone: "SEASONAL", title: "Warm wishes from Enscript University", message: "To every member of our campus community, we wish you a safe and meaningful holiday. Thank you for continuing to create, build, and innovate with us." },
  { id: "NEW_YEAR", label: "New Year welcome", tone: "CELEBRATION", title: "Build what comes next", message: "Happy New Year from Enscript University. This is a new opportunity to set your academic goals, return to your learning studio, and build work you are proud to share." },
] as const;

const navigationOptions = [
  ["learning", "My Courses"], ["programs", "Programs"], ["catalog", "Discover"],
  ["student-center", "Student Center"], ["messages", "Campus Messages"],
  ["faculty", "Faculty Commons"], ["policies", "Policies & Agreements"],
  ["funding", "Funding"], ["submissions", "Assignments & Grades"],
  ["notifications", "Campus Weekly"], ["credentials", "Credentials"], ["profile", "Student Profile"],
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
  const [bannerEnabled, setBannerEnabled] = useState(false);
  const [bannerPreset, setBannerPreset] = useState("CUSTOM");
  const [bannerTone, setBannerTone] = useState("INSTITUTIONAL");
  const [bannerTitle, setBannerTitle] = useState("Welcome to Enscript University");
  const [bannerMessage, setBannerMessage] = useState("");
  const [bannerNotification, setBannerNotification] = useState(true);
  const [hiddenNavigationViews, setHiddenNavigationViews] = useState<string[]>([]);
  const [courseSelectionEnabled, setCourseSelectionEnabled] = useState(true);
  const [programSelectionEnabled, setProgramSelectionEnabled] = useState(true);
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
        setBannerEnabled(operationsResult.status.campusBannerEnabled);
        setBannerPreset(operationsResult.status.campusBannerPreset || "CUSTOM");
        setBannerTone(operationsResult.status.campusBannerTone || "INSTITUTIONAL");
        setBannerTitle(operationsResult.status.campusBannerTitle);
        setBannerMessage(operationsResult.status.campusBannerMessage);
        setHiddenNavigationViews(Array.isArray(operationsResult.status.hiddenNavigationViews) ? operationsResult.status.hiddenNavigationViews : []);
        setCourseSelectionEnabled(operationsResult.status.courseSelectionEnabled !== false);
        setProgramSelectionEnabled(operationsResult.status.programSelectionEnabled !== false);
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

  function chooseBannerPreset(id: string) {
    const preset = bannerPresets.find((item) => item.id === id) || bannerPresets[0];
    setBannerPreset(preset.id);
    if (preset.id !== "CUSTOM") {
      setBannerTitle(preset.title);
      setBannerMessage(preset.message);
      setBannerTone(preset.tone);
      setBannerEnabled(true);
    }
  }

  function toggleNavigationView(view: string, visible: boolean) {
    setHiddenNavigationViews((current) =>
      visible ? current.filter((item) => item !== view) : [...new Set([...current, view])],
    );
  }

  async function saveBanner(action: "publish_banner" | "clear_banner") {
    if (saving) return;
    setSaving(true);
    setMessage(action === "publish_banner" ? "PUBLISHING CAMPUS ANNOUNCEMENT..." : "REMOVING CAMPUS ANNOUNCEMENT...");
    try {
      const response = await fetch("/api/admin/university/operations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, title: bannerTitle, message: bannerMessage, preset: bannerPreset, tone: bannerTone, sendNotification: bannerNotification }),
        signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json();
      setMessage(response.ok ? (action === "publish_banner" ? "CAMPUS ANNOUNCEMENT IS LIVE" : "CAMPUS ANNOUNCEMENT REMOVED") : result.error || "ANNOUNCEMENT COULD NOT BE UPDATED");
      if (response.ok) await load();
    } catch {
      setMessage("THE ANNOUNCEMENT REQUEST DID NOT COMPLETE. RETRY SAFELY.");
    } finally {
      setSaving(false);
    }
  }

  async function saveExperienceControls() {
    if (saving) return;
    setSaving(true);
    setMessage("UPDATING STUDENT CAMPUS ACCESS...");
    try {
      const response = await fetch("/api/admin/university/operations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "set_experience", hiddenNavigationViews, courseSelectionEnabled, programSelectionEnabled }),
        signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json();
      setMessage(response.ok ? "STUDENT NAVIGATION AND SELECTION ACCESS UPDATED" : result.error || "CAMPUS ACCESS COULD NOT BE UPDATED");
      if (response.ok) await load();
    } catch {
      setMessage("THE CAMPUS ACCESS REQUEST DID NOT COMPLETE. RETRY SAFELY.");
    } finally {
      setSaving(false);
    }
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

  async function verifyAlternativeGuardian(applicationId: string) {
    const note = window.prompt(
      "Record the adult identity and parental-authority evidence reviewed. Do not enter ID numbers or copy document images into this note.",
    );
    if (!note || note.length < 20) return;
    if (!window.confirm("Confirm that the reviewed adult is at least 18, matches the named guardian, and has parental responsibility for this applicant.")) return;
    const response = await fetch("/api/admin/university/admissions", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicationId, action: "verify_guardian_alternative", note }),
    });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? "ALTERNATIVE GUARDIAN VERIFICATION RECORDED" : result.error || "GUARDIAN VERIFICATION COULD NOT BE RECORDED");
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

      <div className={styles.experienceControlGrid}>
        <section className={styles.announcementEditor}>
          <header>
            <div><span>CAMPUS HOME ANNOUNCEMENT</span><h3>Publish a student banner</h3></div>
            <em data-active={bannerEnabled}>{bannerEnabled ? "LIVE" : "NOT DISPLAYED"}</em>
          </header>
          <label>
            Announcement preset
            <select value={bannerPreset} onChange={(event) => chooseBannerPreset(event.target.value)}>
              {bannerPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
            </select>
          </label>
          <div className={styles.announcementFields}>
            <label>Banner title<input value={bannerTitle} onChange={(event) => { setBannerTitle(event.target.value); setBannerPreset("CUSTOM"); }} maxLength={120} /></label>
            <label>Presentation<select value={bannerTone} onChange={(event) => setBannerTone(event.target.value)}><option value="INSTITUTIONAL">Institutional</option><option value="CELEBRATION">Celebration</option><option value="SEASONAL">Seasonal</option><option value="IMPORTANT">Important update</option></select></label>
          </div>
          <label>Student message<textarea value={bannerMessage} onChange={(event) => { setBannerMessage(event.target.value); setBannerPreset("CUSTOM"); }} maxLength={700} /></label>
          <div className={styles.bannerPreview} data-tone={bannerTone}>
            <small>LIVE CAMPUS PREVIEW</small><b>{bannerTitle || "Announcement title"}</b><span>{bannerMessage || "Your student-facing message will appear here."}</span>
          </div>
          <label className={styles.inlineCheck}><input type="checkbox" checked={bannerNotification} onChange={(event) => setBannerNotification(event.target.checked)} /><span>Also add this announcement to every active student&apos;s Notifications record.</span></label>
          <div className={styles.actions}>
            <button type="button" disabled={saving || bannerTitle.trim().length < 3 || bannerMessage.trim().length < 12} onClick={() => void saveBanner("publish_banner")}>PUBLISH ANNOUNCEMENT</button>
            {bannerEnabled && <button type="button" disabled={saving} onClick={() => void saveBanner("clear_banner")}>REMOVE FROM CAMPUS HOME</button>}
          </div>
        </section>

        <section className={styles.experienceSettings}>
          <header><span>STUDENT CAMPUS EXPERIENCE</span><h3>Navigation and selection access</h3></header>
          <div className={styles.selectionToggles}>
            <label className={styles.toggleCard}>
              <input type="checkbox" checked={courseSelectionEnabled} onChange={(event) => setCourseSelectionEnabled(event.target.checked)} />
              <span><b>Allow course selection</b><small>Students may browse at any time. Uncheck this to prevent new course enrollment.</small></span>
            </label>
            <label className={styles.toggleCard}>
              <input type="checkbox" checked={programSelectionEnabled} onChange={(event) => setProgramSelectionEnabled(event.target.checked)} />
              <span><b>Allow program selection</b><small>Uncheck this while pathways are being prepared. Existing programs and credits remain unchanged.</small></span>
            </label>
          </div>
          {(!courseSelectionEnabled || !programSelectionEnabled) && (
            <div className={styles.studentNoticePreview}>
              <small>STUDENT POP-UP PREVIEW</small>
              <b>Welcome to Enscript University</b>
              <span>{!courseSelectionEnabled && !programSelectionEnabled ? "Course and program" : !courseSelectionEnabled ? "Course" : "Program"} selection is not open yet. Please return soon; your student record and campus access are ready.</span>
            </div>
          )}
          <fieldset className={styles.navigationChecklist}>
            <legend>Pages shown in student navigation</legend>
            <p>Campus Home always remains available. Hidden pages keep their records and can be restored at any time.</p>
            <div>
              {navigationOptions.map(([id, label]) => (
                <label key={id}><input type="checkbox" checked={!hiddenNavigationViews.includes(id)} onChange={(event) => toggleNavigationView(id, event.target.checked)} /><span>{label}</span></label>
              ))}
            </div>
          </fieldset>
          <div className={styles.actions}>
            <button type="button" disabled={saving} onClick={() => void saveExperienceControls()}>APPLY STUDENT EXPERIENCE</button>
            <button type="button" disabled={saving} onClick={() => { setHiddenNavigationViews([]); setCourseSelectionEnabled(true); setProgramSelectionEnabled(true); }}>RESET DRAFT TO ALL OPEN</button>
          </div>
        </section>
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
                  {application.guardianConsent && (
                    <p>
                      Guardian: {application.guardianConsent.guardianName} ·{" "}
                      {application.guardianConsent.status.replaceAll("_", " ")}
                    </p>
                  )}
                  <span>{application.status.replaceAll("_", " ")} · {job?.decision ? job.decision.outcome : job?.status || "QUEUED"}</span>
                  {job?.decision?.concerns?.length ? <p>{job.decision.concerns.join(" · ")}</p> : null}
                </div>
                <nav>
                  <button onClick={() => void admissionAction(application.id, "retry")}>RETRY</button>
                  {application.guardianConsent?.status === "ALTERNATIVE_REVIEW" && (
                    <button onClick={() => void verifyAlternativeGuardian(application.id)}>
                      VERIFY GUARDIAN
                    </button>
                  )}
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
