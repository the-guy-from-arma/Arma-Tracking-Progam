"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import styles from "./AdmissionStatusView.module.css";

type StatusPayload = {
  application: { status: string; trackingNumber: string; submittedAt: string; history: { status: string; detail?: string; at: string }[] };
  review: { status: string; stage: string; attempt: number; updatedAt: string } | null;
  clarification: { id: string; round: number; questions: string[] } | null;
  award: { academicIdentity: string; studentNumber: string } | null;
  policyActionUrl: string | null;
};

const stages = [
  ["APPLICATION_RECEIVED", "Application received"],
  ["IDENTITY_ELIGIBILITY", "Identity and eligibility"],
  ["ACADEMIC_READINESS", "Academic readiness"],
  ["POLICY_INTEGRITY", "Policy and integrity"],
  ["DECISION_PREPARATION", "Decision preparation"],
];

export function AdmissionStatusView({ applicantName }: { applicantName: string }) {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admissions/status", { cache: "no-store", signal: AbortSignal.timeout(8_000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Admissions status is unavailable.");
      setData(result);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Admissions status is unavailable.");
    }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 5_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);

  async function submitClarification(formData: FormData) {
    if (!data?.clarification) return;
    setBusy(true);
    setError("");
    try {
      const answers = data.clarification.questions.map((_, index) => String(formData.get(`answer-${index}`) || ""));
      const response = await fetch("/api/admissions/clarifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clarificationId: data.clarification.id, answers }), signal: AbortSignal.timeout(15_000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Clarification could not be submitted.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Clarification could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  const status = data?.application.status || "UNDER_AUTOMATED_REVIEW";
  return (
    <main className={styles.page}>
      <header className={styles.masthead}>
        <Image src="/enfusion-university-lockup.png" alt="Enfusion University" width={1600} height={388} priority />
        <span>OFFICE OF ADMISSIONS</span>
      </header>
      <section className={styles.hero}>
        <div>
          <span>APPLICATION STATUS</span>
          <h1>{status === "ADMITTED" ? `Welcome, ${applicantName}.` : `We’re reviewing your path, ${applicantName}.`}</h1>
          <p>{status === "ADMITTED" ? "Your student identity, orientation, advisor, and sponsored-learning account are ready." : status === "CLARIFICATION_REQUIRED" ? "Your application is safe. A few focused details will help us complete the decision." : status === "AUTOMATION_EXCEPTION" ? "Your application is preserved in the admissions exception queue. No automatic denial has been made." : "Eligibility, readiness, policy, and integrity checks are moving through the admissions review."}</p>
        </div>
        <aside><small>TRACKING NUMBER</small><strong>{data?.application.trackingNumber || "LOADING"}</strong><span>{status.replaceAll("_", " ")}</span></aside>
      </section>
      <section className={styles.timeline} aria-label="Admissions review stages">
        {stages.map(([code, label], index) => { const current = stages.findIndex(([stageCode]) => stageCode === data?.review?.stage); return <motion.div key={code} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }} data-active={index <= Math.max(0, current)}><i>{String(index + 1).padStart(2, "0")}</i><span>{label}</span></motion.div>; })}
      </section>
      <AnimatePresence mode="wait">
        {data?.policyActionUrl && <motion.section key="policy" className={styles.admitted} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}><span>POLICY UPDATE</span><h2>Your application is safe and waiting.</h2><p>A material policy changed during review. Sign the current bundle and admissions will resume automatically.</p><Link href={data.policyActionUrl}>REVIEW AND SIGN UPDATED POLICIES →</Link></motion.section>}
        {data?.clarification && (
          <motion.form key="clarification" className={styles.clarification} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} action={submitClarification}>
            <span>CLARIFICATION ROUND {data.clarification.round}</span>
            <h2>Help us understand your goals.</h2>
            {data.clarification.questions.map((question, index) => <label key={question}><b>{question}</b><textarea name={`answer-${index}`} required minLength={20} maxLength={1600} placeholder="Write a specific, honest response. Prior technical experience is not required." /></label>)}
            <button disabled={busy}>{busy ? "SUBMITTING…" : "CONTINUE APPLICATION REVIEW →"}</button>
          </motion.form>
        )}
        {data?.award && (
          <motion.section key="admitted" className={styles.admitted} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
            <span>ADMISSION COMPLETE</span><h2>Your campus identity is active.</h2><dl><div><dt>STUDENT NUMBER</dt><dd>{data.award.studentNumber}</dd></div><div><dt>INTERNAL CAMPUS LOGIN</dt><dd>{data.award.academicIdentity}</dd></div></dl><Link href="/university">BEGIN CAMPUS ORIENTATION →</Link>
          </motion.section>
        )}
      </AnimatePresence>
      {error && <p className={styles.error} role="alert">{error} <button onClick={() => void load()}>Retry</button></p>}
      <footer><Link href="/policies">Policies</Link><span>THUNDER BUDDIES STUDIOS × BLACK RIDGE STUDIOS</span></footer>
    </main>
  );
}
