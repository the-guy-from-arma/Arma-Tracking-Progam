"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./AdmissionStatusView.module.css";

type ApplicationHistory = { status: string; detail?: string; at: string };
type StatusPayload = {
  application: {
    status: string;
    trackingNumber: string;
    trackingStatus: string;
    submittedAt: string;
    reviewedAt: string | null;
    closedAt: string | null;
    lastUpdatedAt: string;
    history: ApplicationHistory[];
    profile: {
      preferredName: string | null;
      country: string;
      timeZone: string;
      experienceLevel: string;
      weeklyHours: number;
      learningGoals: string;
      workbenchExperience: string;
      enforceExperience: string;
      fundingStatement: string;
      portfolioUrl: string | null;
      githubUrl: string | null;
      concentration: string | null;
    };
  };
  review: {
    status: string;
    stage: string;
    attempt: number;
    maxAttempts: number;
    updatedAt: string;
    decision: {
      outcome: string;
      strengths: string[];
      concerns: string[];
    } | null;
  } | null;
  clarification: { id: string; round: number; questions: string[] } | null;
  award: { academicIdentity: string; studentNumber: string } | null;
  policyActionUrl: string | null;
  guardian: {
    required: boolean;
    status: string;
    guardianName: string;
    relationship: string;
    expiresAt: string;
    verifiedAt: string | null;
    failureCode: string | null;
    alternativeRequestedAt: string | null;
    canCreateInvitation: boolean;
  } | null;
};

const stages = [
  {
    code: "APPLICATION_RECEIVED",
    label: "Application received",
    detail:
      "Your signed application, tracking record, and submitted responses are safely recorded.",
  },
  {
    code: "GUARDIAN_PERMISSION",
    label: "Guardian authorization",
    detail:
      "For applicants age 16 or 17, a parent or legal guardian signs separately and completes adult identity verification before academic review begins.",
  },
  {
    code: "IDENTITY_ELIGIBILITY",
    label: "Identity and eligibility",
    detail:
      "Admissions checks the required contact information, age eligibility, and application completeness.",
  },
  {
    code: "ACADEMIC_READINESS",
    label: "Academic readiness",
    detail:
      "Your goals, available study time, technical background, and requested pathway are reviewed together.",
  },
  {
    code: "POLICY_INTEGRITY",
    label: "Policy and integrity",
    detail:
      "The signed policy bundle and application responses are checked for consistency and integrity flags.",
  },
  {
    code: "DECISION_PREPARATION",
    label: "Decision preparation",
    detail:
      "Admissions prepares an admission decision, focused clarification request, or protected exception review.",
  },
] as const;

const pendingStatuses = new Set([
  "SUBMITTED",
  "UNDER_AUTOMATED_REVIEW",
  "GUARDIAN_CONSENT_REQUIRED",
  "CLARIFICATION_REQUIRED",
  "AUTOMATION_EXCEPTION",
]);

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusCopy(status: string) {
  if (status === "ADMITTED")
    return "Your student identity, orientation, advisor, and sponsored-learning account are ready.";
  if (status === "CLARIFICATION_REQUIRED")
    return "Your application is safe. Answer the focused questions below so admissions can continue.";
  if (status === "AUTOMATION_EXCEPTION")
    return "Your application is preserved for protected exception review. No automatic denial has been made.";
  if (status === "GUARDIAN_CONSENT_REQUIRED")
    return "Your application is safely recorded. A parent or legal guardian must complete the separate consent and adult identity check before academic review begins.";
  if (status === "DECLINED")
    return "A final admissions decision has been recorded. The status history below preserves the decision path.";
  return "Your application is moving through eligibility, readiness, policy, and decision review.";
}

export function AdmissionStatusView({ applicantName }: { applicantName: string }) {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [guardianInvitation, setGuardianInvitation] = useState("");

  const load = useCallback(async (showProgress = false) => {
    if (showProgress) setRefreshing(true);
    try {
      const response = await fetch("/api/admissions/status", {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.error || "Admissions status is unavailable.");
      setData(result);
      setLastChecked(new Date());
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Admissions status is unavailable.",
      );
    } finally {
      if (showProgress) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initial);
  }, [load]);

  useEffect(() => {
    if (!data || !pendingStatuses.has(data.application.status)) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [data, load]);

  async function submitClarification(formData: FormData) {
    if (!data?.clarification) return;
    setBusy(true);
    setError("");
    try {
      const answers = data.clarification.questions.map((_, index) =>
        String(formData.get(`answer-${index}`) || ""),
      );
      const response = await fetch("/api/admissions/clarifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clarificationId: data.clarification.id,
          answers,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.error || "Clarification could not be submitted.");
      await load(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Clarification could not be submitted.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.assign("/");
  }

  async function createGuardianInvitation() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admissions/guardian-invitation", {
        method: "POST",
        signal: AbortSignal.timeout(12_000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Guardian invitation could not be created.");
      setGuardianInvitation(result.invitationUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Guardian invitation could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function copyGuardianInvitation() {
    if (!guardianInvitation) return;
    await navigator.clipboard.writeText(guardianInvitation);
  }

  const status = data?.application.status || "UNDER_AUTOMATED_REVIEW";
  const visibleStages = useMemo(
    () => data?.guardian ? stages : stages.filter((stage) => stage.code !== "GUARDIAN_PERMISSION"),
    [data?.guardian],
  );
  const currentStageIndex = useMemo(() => {
    if (status === "ADMITTED" || status === "DECLINED") return visibleStages.length;
    const index = visibleStages.findIndex((stage) => stage.code === data?.review?.stage);
    return Math.max(0, index);
  }, [data?.review?.stage, status, visibleStages]);
  const selectedStageRecord =
    visibleStages.find((stage) => stage.code === selectedStage) ||
    visibleStages[Math.min(currentStageIndex, visibleStages.length - 1)];

  return (
    <main className={styles.page}>
      <header className={styles.masthead}>
        <Link href="/">
          <Image
            src="/enscript-university-lockup.png"
            alt="Enscript University"
            width={1983}
            height={793}
            priority
          />
        </Link>
        <nav aria-label="Admissions account navigation">
          <Link href="/policies">POLICY CENTER</Link>
          <Link href="/policies/contact">CONTACT ADMISSIONS</Link>
          <button type="button" onClick={() => void signOut()}>
            SIGN OUT
          </button>
        </nav>
      </header>

      <section className={styles.hero}>
        <div>
          <span>OFFICE OF ADMISSIONS / APPLICATION STATUS</span>
          <h1>
            {status === "ADMITTED"
              ? `Welcome, ${applicantName}.`
              : `Your application has a clear path, ${applicantName}.`}
          </h1>
          <p>{statusCopy(status)}</p>
          <div className={styles.heroActions}>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void load(true)}
            >
              {refreshing ? "CHECKING…" : "REFRESH APPLICATION STATUS"}
            </button>
            {data?.award && <Link href="/university">ENTER STUDENT CAMPUS →</Link>}
          </div>
        </div>
        <aside>
          <small>TRACKING NUMBER</small>
          <strong>{data?.application.trackingNumber || "LOADING"}</strong>
          <span>{status.replaceAll("_", " ")}</span>
          <dl>
            <div>
              <dt>SUBMITTED</dt>
              <dd>{formatDate(data?.application.submittedAt)}</dd>
            </div>
            <div>
              <dt>LAST CHECKED</dt>
              <dd>{lastChecked ? formatDate(lastChecked.toISOString()) : "Opening record"}</dd>
            </div>
          </dl>
        </aside>
      </section>

      {!data && !error && (
        <section className={styles.loading} role="status">
          Opening your admissions record…
        </section>
      )}

      {data && (
        <>
          <section className={styles.timelineSection}>
            <header>
              <div>
                <small>LIVE REVIEW PATH</small>
                <h2>Where your application is now</h2>
              </div>
              <span>
                {currentStageIndex >= visibleStages.length
                  ? "REVIEW COMPLETE"
                  : `STAGE ${currentStageIndex + 1} OF ${visibleStages.length}`}
              </span>
            </header>
            <div className={styles.timeline} aria-label="Admissions review stages">
              {visibleStages.map((stage, index) => (
                <motion.button
                  type="button"
                  key={stage.code}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  data-state={
                    index < currentStageIndex
                      ? "complete"
                      : index === currentStageIndex
                        ? "current"
                        : "upcoming"
                  }
                  aria-current={index === currentStageIndex ? "step" : undefined}
                  onClick={() => setSelectedStage(stage.code)}
                >
                  <i>{index < currentStageIndex ? "✓" : String(index + 1).padStart(2, "0")}</i>
                  <span>{stage.label}</span>
                  <small>{index === currentStageIndex ? "CURRENT" : index < currentStageIndex ? "COMPLETE" : "UPCOMING"}</small>
                </motion.button>
              ))}
            </div>
            <motion.article
              key={selectedStageRecord.code}
              className={styles.stageReader}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span>{selectedStageRecord.code.replaceAll("_", " ")}</span>
              <h3>{selectedStageRecord.label}</h3>
              <p>{selectedStageRecord.detail}</p>
            </motion.article>
          </section>

          <section className={styles.recordGrid}>
            <article className={styles.currentReview}>
              <small>CURRENT REVIEW LOCATION</small>
              <h2>{selectedStageRecord.label}</h2>
              <dl>
                <div>
                  <dt>APPLICATION STATUS</dt>
                  <dd>{status.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt>REVIEW QUEUE</dt>
                  <dd>{data.review?.status.replaceAll("_", " ") || "RECORD CREATED"}</dd>
                </div>
                <div>
                  <dt>LAST REVIEW UPDATE</dt>
                  <dd>{formatDate(data.review?.updatedAt || data.application.lastUpdatedAt)}</dd>
                </div>
                <div>
                  <dt>TRACKING RECORD</dt>
                  <dd>{data.application.trackingStatus || "IN REVIEW"}</dd>
                </div>
              </dl>
              <p>
                The page checks for movement automatically while it is open. You
                may safely sign out and return later with the recovery email used
                on the application.
              </p>
            </article>

            <article className={styles.nextAction}>
              <small>YOUR NEXT ACTION</small>
              <h2>
                {data.clarification
                  ? "Answer the admissions questions"
                  : data.policyActionUrl
                    ? "Sign the updated policy bundle"
                    : data.award
                      ? "Begin campus orientation"
                      : "No action is required right now"}
              </h2>
              <p>
                {data.clarification
                  ? "Admissions cannot continue until the focused responses below are submitted."
                  : data.policyActionUrl
                    ? "Your review is paused safely until the current material policy versions are signed."
                    : data.award
                      ? "Your student account is active and the orientation course is ready."
                      : "Keep this tracking number for your records. A clarification request or decision will appear here."}
              </p>
              {data.policyActionUrl && (
                <Link href={`${data.policyActionUrl}?returnTo=${encodeURIComponent("/admissions/status")}`}>
                  REVIEW AND SIGN POLICIES →
                </Link>
              )}
              {data.award && <Link href="/university">OPEN STUDENT CAMPUS →</Link>}
            </article>
          </section>

          <section className={styles.applicationRecord}>
            <details open>
              <summary>
                <span>SUBMITTED APPLICATION</span>
                <b>Review what admissions received</b>
              </summary>
              <div className={styles.applicationFacts}>
                <dl>
                  <div><dt>CONCENTRATION</dt><dd>{data.application.profile.concentration || "General Enfusion Workbench development"}</dd></div>
                  <div><dt>EXPERIENCE LEVEL</dt><dd>{data.application.profile.experienceLevel.replaceAll("_", " ")}</dd></div>
                  <div><dt>WEEKLY AVAILABILITY</dt><dd>{data.application.profile.weeklyHours} hours</dd></div>
                  <div><dt>TIME ZONE</dt><dd>{data.application.profile.timeZone}</dd></div>
                </dl>
                <article><small>LEARNING GOALS</small><p>{data.application.profile.learningGoals}</p></article>
                <article><small>WORKBENCH BACKGROUND</small><p>{data.application.profile.workbenchExperience}</p></article>
                <article><small>PROGRAMMING BACKGROUND</small><p>{data.application.profile.enforceExperience}</p></article>
                <article><small>SPONSORED-ACCESS STATEMENT</small><p>{data.application.profile.fundingStatement}</p></article>
                {(data.application.profile.portfolioUrl || data.application.profile.githubUrl) && (
                  <nav>
                    {data.application.profile.portfolioUrl && <a href={data.application.profile.portfolioUrl} target="_blank" rel="noreferrer">OPEN PORTFOLIO / WORKSHOP ↗</a>}
                    {data.application.profile.githubUrl && <a href={data.application.profile.githubUrl} target="_blank" rel="noreferrer">OPEN GITHUB PROFILE ↗</a>}
                  </nav>
                )}
              </div>
            </details>

            <details>
              <summary>
                <span>STATUS HISTORY</span>
                <b>{data.application.history.length} recorded updates</b>
              </summary>
              <ol className={styles.history}>
                {[...data.application.history].reverse().map((event, index) => (
                  <li key={`${event.status}-${event.at}-${index}`}>
                    <i />
                    <div>
                      <b>{event.status.replaceAll("_", " ")}</b>
                      <p>{event.detail || "Admissions status updated."}</p>
                    </div>
                    <time>{formatDate(event.at)}</time>
                  </li>
                ))}
                {!data.application.history.length && <li>No tracking events have been recorded yet.</li>}
              </ol>
            </details>
          </section>
        </>
      )}

      <AnimatePresence mode="wait">
        {data?.guardian && data.guardian.status !== "VERIFIED" && (
          <motion.section
            key="guardian"
            className={styles.guardianPanel}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span>REQUIRED BEFORE ADMISSION</span>
            <h2>Parent or guardian authorization</h2>
            <p>
              {data.guardian.status === "ALTERNATIVE_REVIEW"
                ? "An alternative verification request is open. The application remains pending while Admissions arranges the next step."
                : `Create a private one-time link for ${data.guardian.guardianName}. The adult signs separately and completes hosted identity verification.`}
            </p>
            {guardianInvitation ? (
              <div className={styles.invitationBox}>
                <label>ONE-TIME GUARDIAN LINK<input readOnly value={guardianInvitation} /></label>
                <button type="button" onClick={() => void copyGuardianInvitation()}>COPY SECURE LINK</button>
              </div>
            ) : data.guardian.status !== "ALTERNATIVE_REVIEW" ? (
              <button type="button" disabled={busy} onClick={() => void createGuardianInvitation()}>
                {busy ? "CREATING LINK…" : "CREATE GUARDIAN INVITATION →"}
              </button>
            ) : null}
            <small>Share the link only with the named adult. Creating a new link invalidates the previous one.</small>
          </motion.section>
        )}

        {data?.policyActionUrl && (
          <motion.section
            key="policy"
            className={styles.actionPanel}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span>POLICY UPDATE</span>
            <h2>Your application is safe and waiting.</h2>
            <p>
              A material policy changed during review. Sign the current bundle
              and admissions will resume automatically.
            </p>
            <Link href={`${data.policyActionUrl}?returnTo=${encodeURIComponent("/admissions/status")}`}>
              REVIEW AND SIGN UPDATED POLICIES →
            </Link>
          </motion.section>
        )}

        {data?.clarification && (
          <motion.form
            key="clarification"
            className={styles.clarification}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            action={submitClarification}
          >
            <span>CLARIFICATION ROUND {data.clarification.round}</span>
            <h2>Help us understand your goals.</h2>
            {data.clarification.questions.map((question, index) => (
              <label key={question}>
                <b>{question}</b>
                <textarea
                  name={`answer-${index}`}
                  required
                  minLength={20}
                  maxLength={1600}
                  placeholder="Write a specific, honest response. Prior technical experience is not required."
                />
              </label>
            ))}
            <button disabled={busy}>
              {busy ? "SUBMITTING…" : "CONTINUE APPLICATION REVIEW →"}
            </button>
          </motion.form>
        )}

        {data?.award && (
          <motion.section
            key="admitted"
            className={styles.actionPanel}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <span>ADMISSION COMPLETE</span>
            <h2>Your campus identity is active.</h2>
            <dl>
              <div><dt>STUDENT NUMBER</dt><dd>{data.award.studentNumber}</dd></div>
              <div><dt>INTERNAL CAMPUS LOGIN</dt><dd>{data.award.academicIdentity}</dd></div>
            </dl>
            <Link href="/university">BEGIN CAMPUS ORIENTATION →</Link>
          </motion.section>
        )}
      </AnimatePresence>

      {error && (
        <p className={styles.error} role="alert">
          {error} <button onClick={() => void load(true)}>Retry</button>
        </p>
      )}

      <footer>
        <nav><Link href="/">University home</Link><Link href="/policies">Policies</Link><Link href="/policies/contact">Admissions support</Link></nav>
        <span>THUNDER BUDDIES STUDIOS × BLACK RIDGE STUDIOS</span>
      </footer>
    </main>
  );
}
