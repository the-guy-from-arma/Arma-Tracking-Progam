"use client";

import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, ScanFace, FileCheck2, LockKeyhole } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import styles from "./GuardianConsentView.module.css";

type Consent = {
  applicantName: string;
  guardianName: string;
  guardianEmail: string;
  relationship: string;
  status: string;
  expiresAt: string;
  verifiedAt: string | null;
  failureCode: string | null;
  alternativeRequestedAt: string | null;
};

export function GuardianConsentView({ token }: { token: string }) {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [alternative, setAlternative] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/guardian-consent/${token}`, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Guardian invitation unavailable.");
    setConsent(result.consent);
  }, [token]);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Guardian invitation unavailable."));
    }, 0);
    return () => window.clearTimeout(initial);
  }, [load]);
  useEffect(() => {
    if (!consent || !["IDENTITY_PENDING", "PROCESSING"].includes(consent.status)) return;
    const timer = window.setInterval(() => void load().catch(() => undefined), 4_000);
    return () => window.clearInterval(timer);
  }, [consent, load]);

  async function submit(formData: FormData) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/guardian-consent/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "begin_verification",
          signerName: formData.get("signerName"),
          parentalResponsibilityAttested: formData.has("parentalResponsibilityAttested"),
          studentParticipationAuthorized: formData.has("studentParticipationAuthorized"),
          privacyAcknowledged: formData.has("privacyAcknowledged"),
        }),
        signal: AbortSignal.timeout(45_000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Verification could not begin.");
      if (result.redirectUrl) window.location.assign(result.redirectUrl);
      else await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Verification could not begin.");
    } finally { setBusy(false); }
  }

  async function requestAlternative(formData: FormData) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/guardian-consent/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "request_alternative", reason: formData.get("reason"), signerName: formData.get("signerName"), parentalResponsibilityAttested: formData.has("parentalResponsibilityAttested"), studentParticipationAuthorized: formData.has("studentParticipationAuthorized"), privacyAcknowledged: formData.has("privacyAcknowledged") }),
        signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Alternative review could not be requested.");
      setConsent((current) => current ? { ...current, ...result.consent } : result.consent);
      setAlternative(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Alternative review could not be requested.");
    } finally { setBusy(false); }
  }

  const complete = consent?.status === "VERIFIED";
  return (
    <main className={styles.page}>
      <header className={styles.masthead}>
        <Link href="/"><Image src="/enscript-university-lockup.png" alt="Enscript University" width={1983} height={793} priority /></Link>
        <span>OFFICE OF ADMISSIONS · GUARDIAN SERVICES</span>
      </header>
      <section className={styles.shell}>
        <aside>
          <small>SECURE AUTHORIZATION</small>
          <h1>{complete ? "Verification complete." : "Protect their next step."}</h1>
          <p>This invitation is for the parent or legal guardian of <strong>{consent?.applicantName || "the applicant"}</strong>.</p>
          <ol>
            <li><FileCheck2 /><span><b>Review and consent</b>Confirm parental responsibility and educational participation.</span></li>
            <li><ScanFace /><span><b>Verify the adult</b>Complete the identity provider’s document and live-selfie check.</span></li>
            <li><ShieldCheck /><span><b>Return only a result</b>The university stores the verification status—not the ID image or selfie.</span></li>
          </ol>
          <div className={styles.privacy}><LockKeyhole /><p>Identity evidence is handled on the provider’s hosted service. It is not used for academic scoring or sent to Gemini.</p></div>
        </aside>
        <article className={styles.reader}>
          {!consent && !error && <p role="status">Opening secure invitation…</p>}
          {consent && complete && <div className={styles.complete}><ShieldCheck /><small>ADMISSIONS VERIFICATION</small><h2>Consent and adult identity confirmed</h2><p>Enscript University has resumed the applicant’s admissions review. No further identity action is required.</p><dl><div><dt>GUARDIAN</dt><dd>{consent.guardianName}</dd></div><div><dt>VERIFIED</dt><dd>{consent.verifiedAt ? new Date(consent.verifiedAt).toLocaleString() : "Recorded"}</dd></div></dl></div>}
          {consent && consent.status === "ALTERNATIVE_REVIEW" && <div className={styles.complete}><small>ALTERNATIVE REVIEW REQUESTED</small><h2>Your request is safely recorded.</h2><p>Admissions will use the policy contact process to arrange an appropriate alternative. The applicant remains pending and is not denied.</p></div>}
          {consent && ["IDENTITY_PENDING", "PROCESSING"].includes(consent.status) && <div className={styles.processing}><span /><small>IDENTITY PROVIDER</small><h2>Verification is processing</h2><p>This page will update automatically when the verified adult/name-match result arrives.</p></div>}
          {consent && !complete && !["ALTERNATIVE_REVIEW", "IDENTITY_PENDING", "PROCESSING"].includes(consent.status) && !alternative && (
            <form action={submit}>
              <span>GUARDIAN CONSENT RECORD</span><h2>Authorize this application</h2><p>Signed for <b>{consent.applicantName}</b>. Invitation addressed to {consent.guardianEmail}.</p>
              {consent.status === "REQUIRES_INPUT" && <div className={styles.notice}>The provider could not complete the previous check ({consent.failureCode?.replaceAll("_", " ") || "verification needs input"}). Review the details and try again or request another method.</div>}
              {consent.status === "EXPIRED" ? <div className={styles.notice}>This invitation has expired. Ask the applicant to issue a new secure link from the admissions tracking page.</div> : <>
                <label>TYPE YOUR FULL LEGAL NAME TO SIGN<input name="signerName" required defaultValue={consent.guardianName} autoComplete="name" /></label>
                <label className={styles.check}><input name="parentalResponsibilityAttested" type="checkbox" required /><span><b>Parental responsibility</b>I am the applicant’s parent or legal guardian and have authority to provide this consent.</span></label>
                <label className={styles.check}><input name="studentParticipationAuthorized" type="checkbox" required /><span><b>Participation authorization</b>I authorize this 16- or 17-year-old applicant to apply for and, if admitted, participate in Enscript University’s online learning services.</span></label>
                <label className={styles.check}><input name="privacyAcknowledged" type="checkbox" required /><span><b>Identity and privacy notice</b>I understand the hosted provider checks my government ID and live selfie, while Enscript University retains only limited consent and verification-result records.</span></label>
                <button disabled={busy}>{busy ? "CREATING SECURE SESSION…" : "CONSENT AND VERIFY IDENTITY →"}</button>
              </>}
              <button className={styles.alternativeButton} type="button" onClick={() => setAlternative(true)}>REQUEST AN ALTERNATIVE VERIFICATION METHOD</button>
            </form>
          )}
          {consent && alternative && <form action={requestAlternative}><span>ACCESSIBLE ALTERNATIVE</span><h2>Request another verification route</h2><p>Government ID is not the only available route. Complete the same guardian consent record, then explain the accessibility, document-availability, or privacy reason for the request. Admissions will not treat the request as a denial.</p><label>TYPE YOUR FULL LEGAL NAME TO SIGN<input name="signerName" required defaultValue={consent.guardianName} autoComplete="name" /></label><label className={styles.check}><input name="parentalResponsibilityAttested" type="checkbox" required /><span><b>Parental responsibility</b>I am the applicant’s parent or legal guardian and have authority to provide this consent.</span></label><label className={styles.check}><input name="studentParticipationAuthorized" type="checkbox" required /><span><b>Participation authorization</b>I authorize this applicant to apply for and, if admitted, participate in the university’s online learning services.</span></label><label className={styles.check}><input name="privacyAcknowledged" type="checkbox" required /><span><b>Identity and privacy notice</b>I understand the alternative route will be documented and will not require the university to store a government-ID image or ID number.</span></label><label>REASON FOR ALTERNATIVE REVIEW<textarea name="reason" required minLength={10} maxLength={600} /></label><button disabled={busy}>{busy ? "RECORDING REQUEST…" : "SIGN AND SUBMIT ALTERNATIVE REQUEST"}</button><button type="button" className={styles.alternativeButton} onClick={() => setAlternative(false)}>RETURN TO STANDARD VERIFICATION</button></form>}
          {error && <p className={styles.error} role="alert">{error}</p>}
        </article>
      </section>
      <footer><Link href="/policies">Policy Center</Link><Link href="/policies/contact">Contact admissions</Link><span>THUNDER BUDDIES STUDIOS × BLACK RIDGE STUDIOS</span></footer>
    </main>
  );
}
