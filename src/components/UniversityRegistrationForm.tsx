"use client";

import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicPolicy } from "./PolicyCenter";

type Award = {
  academicIdentity: string;
  studentNumber: string;
  applicationTrackingNumber: string;
  estimatedProgramValueCents: number;
  grantAwardCents: number;
  studentDueCents: number;
  availableGrantBalanceCents: number;
  breakdown: { label: string; amountCents: number }[];
  disclosure: string;
};
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
const steps = [
  { title: "Identity + contact", copy: "Create your secure learner record" },
  { title: "Technical background", copy: "Personalize course placement" },
  { title: "Academic intent", copy: "Define what you want to build" },
  { title: "Sponsorship", copy: "Prepare your learning award" },
  { title: "Application review", copy: "Certify your information" },
  { title: "Policies + signature", copy: "Review, acknowledge, and e-sign" },
];

export function UniversityRegistrationForm({
  existingEmail = "",
  existingName = "",
}: {
  existingEmail?: string;
  existingName?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [award, setAward] = useState<Award | null>(null);
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [policies, setPolicies] = useState<PublicPolicy[]>([]);
  const [reviewedPolicies, setReviewedPolicies] = useState<string[]>([]);
  const [pendingApplication, setPendingApplication] = useState<Record<
    string,
    unknown
  > | null>(null);

  useEffect(() => {
    void fetch("/api/policies").then((response) => response.json()).then((payload) => setPolicies(payload.policies || []));
  }, []);

  function move(next: number, source?: HTMLElement) {
    if (next > step && source) {
      const fieldset = source.closest("fieldset");
      const invalid = fieldset?.querySelector<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >(":invalid");
      if (invalid) {
        invalid.reportValidity();
        invalid.focus();
        return;
      }
    }
    setStep(next);
    setFurthest((value) => Math.max(value, next));
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const invalid = form.querySelector<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >(":invalid");
    if (invalid) {
      const invalidStep = Number(
        invalid.closest("fieldset")?.dataset.step ?? step,
      );
      const section = steps[invalidStep]?.title || "application";
      setStep(invalidStep);
      setFurthest((value) => Math.max(value, invalidStep));
      setError(
        `Your application has not been submitted. Complete the ${section} section, then return to final review.`,
      );
      window.setTimeout(() => {
        invalid.reportValidity();
        invalid.focus();
      }, 50);
      return;
    }
    const entries = Object.fromEntries(new FormData(form));
    setPendingApplication({
      ...entries,
      acceptPolicies: Boolean(entries.acceptPolicies),
      policyVersionIds: policies.map((policy) => policy.version.id),
      policyAcknowledgements: policies.map((policy) => policy.version.id),
      ageAttested: Boolean(entries.ageAttested),
      electronicConsent: Boolean(entries.electronicConsent),
    });
  }
  async function confirmSubmission() {
    if (!pendingApplication || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/university-register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(pendingApplication),
      });
      const result = await response.json();
      if (!response.ok) {
        setPendingApplication(null);
        setStep(5);
        setError(
          result.error ||
            "Application could not be completed. Nothing was submitted.",
        );
        return;
      }
      setAward(result.award);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setPendingApplication(null);
      setStep(5);
      setError(
        "The application service could not be reached. Nothing was submitted; please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (award)
    return (
      <AwardDecision
        award={award}
        enter={() => {
          router.push("/university");
          router.refresh();
        }}
      />
    );

  return (
    <main className="admissionsPage">
      <div className="admissionsAurora" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <header className="admissionsHeader">
        <Link href="/" className="admissionsBrand">
          <Image
            src="/enfusion-university-lockup.png"
            alt="Enfusion University — Create, Build, Innovate"
            width={1600}
            height={388}
            priority
          />
        </Link>
        <div>
          <span>OFFICE OF ADMISSIONS</span>
          <b>ONLINE APPLICATION</b>
        </div>
        <Link href="/university/login">STUDENT SIGN IN ↗</Link>
      </header>
      <div className="admissionsLayout">
        <aside className="admissionsRail">
          <div className="admissionsRailLogo">
            <Image
              src="/enfusion-university-lockup.png"
              alt="Enfusion University"
              width={1600}
              height={388}
            />
          </div>
          <p>APPLICATION PROGRESS</p>
          <nav aria-label="Application sections">
            {steps.map((item, index) => (
              <button
                type="button"
                disabled={index > furthest}
                className={step === index ? "on" : index < step ? "done" : ""}
                onClick={() => move(index)}
                key={item.title}
              >
                <span>
                  {index < step ? "✓" : String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <b>{item.title}</b>
                  <small>{item.copy}</small>
                </div>
              </button>
            ))}
          </nav>
          <section>
            <small>SPONSORED LEARNING</small>
            <strong>$0 STUDENT COST</strong>
            <p>
              Every admitted learner is automatically considered for a Thunder
              Buddies Studios learning award.
            </p>
            <div>
              <span>APPLICATION FEE</span>
              <b>$0</b>
            </div>
            <div>
              <span>STUDENT DEBT</span>
              <b>$0</b>
            </div>
          </section>
        </aside>
        <form className="admissionsForm" onSubmit={submit} noValidate>
          <header className="admissionsIntro">
            <div>
              <p>ENFUSION UNIVERSITY / ADMISSIONS</p>
              <h1>
                Build your future
                <br />
                <em>inside Enfusion.</em>
              </h1>
              <span>
                A detailed application for your academic identity, personalized
                placement, sponsored-learning balance, and first 120-day term.
              </span>
            </div>
            <div className="applicationProgress">
              <span
                style={
                  {
                    "--application-progress": `${(step + 1) * 20}%`,
                  } as React.CSSProperties
                }
              />
              <small>SECTION {step + 1} OF 5</small>
              <b>{(step + 1) * 20}% COMPLETE</b>
            </div>
          </header>
          {error && (
            <p className="admissionsStatusError" role="alert">
              <b>Application needs attention</b>
              <span>{error}</span>
            </p>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 18, filter: "blur(5px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -12, filter: "blur(4px)" }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              <fieldset
                className={`admissionStep ${step === 0 ? "active" : ""}`}
                data-step="0"
              >
                <legend>
                  <span>01</span>
                  <div>
                    <small>LET&apos;S BEGIN</small>
                    <b>Identity and contact</b>
                    <p>
                      Establish your secure academic identity and recovery
                      information.
                    </p>
                  </div>
                </legend>
                <div className="fieldGrid">
                  <label className="wide">
                    FULL LEGAL OR PUBLIC NAME
                    <input
                      name="name"
                      defaultValue={existingName}
                      required
                      minLength={2}
                      autoComplete="name"
                      placeholder="Alex Morgan"
                    />
                  </label>
                  <label>
                    PREFERRED NAME <small>OPTIONAL</small>
                    <input name="preferredName" placeholder="Alex" />
                  </label>
                  <label>
                    RECOVERY EMAIL
                    <input
                      name="email"
                      defaultValue={existingEmail}
                      readOnly={Boolean(existingEmail)}
                      required
                      type="email"
                      autoComplete="email"
                      placeholder="alex@example.com"
                    />
                    <small>
                      Your private contact email—not your campus identity.
                    </small>
                  </label>
                  <label>
                    COUNTRY OR REGION
                    <input
                      name="country"
                      required
                      placeholder="United States"
                    />
                  </label>
                  <label>
                    TIME ZONE
                    <input
                      name="timeZone"
                      required
                      defaultValue={
                        Intl.DateTimeFormat().resolvedOptions().timeZone
                      }
                      placeholder="America/New_York"
                    />
                  </label>
                  <label className="wide">
                    CREATE A SECURE PASSWORD
                    <input
                      name="password"
                      required
                      type="password"
                      minLength={12}
                      autoComplete="new-password"
                      placeholder="At least 12 characters"
                    />
                    <small>
                      Use 12 or more characters. Never reuse another account
                      password.
                    </small>
                  </label>
                </div>
                <StepActions
                  first
                  next={(event) => move(1, event.currentTarget)}
                />
              </fieldset>
              <fieldset
                className={`admissionStep ${step === 1 ? "active" : ""}`}
                data-step="1"
              >
                <legend>
                  <span>02</span>
                  <div>
                    <small>PLACEMENT PROFILE</small>
                    <b>Technical background</b>
                    <p>
                      There is no minimum experience. This information
                      personalizes your starting point.
                    </p>
                  </div>
                </legend>
                <div className="fieldGrid">
                  <label>
                    EXPERIENCE LEVEL
                    <select name="experienceLevel" required>
                      <option value="">Choose your current level</option>
                      <option value="NEW">New to game development</option>
                      <option value="BEGINNER">
                        Beginner / guided projects
                      </option>
                      <option value="INTERMEDIATE">
                        Intermediate / shipped small mods
                      </option>
                      <option value="ADVANCED">
                        Advanced / complex systems
                      </option>
                      <option value="PROFESSIONAL">
                        Professional development experience
                      </option>
                    </select>
                  </label>
                  <label>
                    PRIMARY CONCENTRATION
                    <select name="specialty" required>
                      <option>Enfusion scripting</option>
                      <option>Game systems design</option>
                      <option>Terrain and world building</option>
                      <option>3D assets and vehicles</option>
                      <option>Animation</option>
                      <option>Audio design</option>
                      <option>Quality assurance</option>
                      <option>Technical production</option>
                    </select>
                  </label>
                  <label className="wide">
                    ARMA REFORGER WORKBENCH EXPERIENCE
                    <textarea
                      name="workbenchExperience"
                      required
                      minLength={20}
                      placeholder="Describe tools used, projects attempted, published mods, or what you want to learn first…"
                    />
                  </label>
                  <label className="wide">
                    ENFORCE SCRIPT OR PROGRAMMING EXPERIENCE
                    <textarea
                      name="enforceExperience"
                      required
                      minLength={20}
                      placeholder="Describe technical experience, or explain that you are completely new and what interests you."
                    />
                  </label>
                  <label>
                    WEEKLY STUDY AVAILABILITY
                    <div className="numberField">
                      <input
                        name="weeklyHours"
                        required
                        type="number"
                        min="1"
                        max="60"
                        defaultValue="8"
                      />
                      <span>HOURS / WEEK</span>
                    </div>
                  </label>
                  <label>
                    GITHUB PROFILE <small>OPTIONAL</small>
                    <input
                      name="githubUrl"
                      type="url"
                      placeholder="https://github.com/…"
                    />
                  </label>
                  <label className="wide">
                    PORTFOLIO OR WORKSHOP PAGE <small>OPTIONAL</small>
                    <input
                      name="portfolioUrl"
                      type="url"
                      placeholder="https://…"
                    />
                  </label>
                </div>
                <StepActions
                  back={() => move(0)}
                  next={(event) => move(2, event.currentTarget)}
                />
              </fieldset>
              <fieldset
                className={`admissionStep ${step === 2 ? "active" : ""}`}
                data-step="2"
              >
                <legend>
                  <span>03</span>
                  <div>
                    <small>YOUR DIRECTION</small>
                    <b>Academic intent</b>
                    <p>
                      Help faculty and the course system understand where you
                      want to advance.
                    </p>
                  </div>
                </legend>
                <div className="intentPrompt">
                  <div>
                    <b>Think beyond a course.</b>
                    <p>
                      Describe the mods you want to build, the role you want to
                      grow into, and the technical outcome that would make this
                      experience successful.
                    </p>
                  </div>
                  <span>MINIMUM 80 CHARACTERS</span>
                </div>
                <label className="largeField">
                  LEARNING GOALS AND PROFESSIONAL DIRECTION
                  <textarea
                    name="learningGoals"
                    required
                    minLength={80}
                    placeholder="I want to learn how to design, build, validate, and publish…"
                  />
                </label>
                <StepActions
                  back={() => move(1)}
                  next={(event) => move(3, event.currentTarget)}
                />
              </fieldset>
              <fieldset
                className={`admissionStep ${step === 3 ? "active" : ""}`}
                data-step="3"
              >
                <legend>
                  <span>04</span>
                  <div>
                    <small>SPONSORED ACCESS</small>
                    <b>Your learning award</b>
                    <p>
                      Preview how institutional sponsorship keeps student
                      responsibility at $0.
                    </p>
                  </div>
                </legend>
                <div className="grantPreview">
                  <div>
                    <small>INITIAL SPONSORED LEARNING AWARD</small>
                    <strong>UP TO $50,000</strong>
                    <span>Applied to your first 120-day term</span>
                  </div>
                  <div>
                    <small>STUDENT RESPONSIBILITY</small>
                    <strong>$0.00</strong>
                    <span>No payment information required</span>
                  </div>
                  <p>
                    Course service values represent instruction, labs, technical
                    infrastructure, assessment, and credential administration.
                    Awards are internal, noncashable learning credits.
                  </p>
                </div>
                <label className="largeField">
                  HOW WILL SPONSORED ACCESS HELP YOU COMPLETE THIS PROGRAM?
                  <textarea
                    name="fundingStatement"
                    required
                    minLength={40}
                    placeholder="Describe your commitment, the value of access, and how you will use the opportunity responsibly…"
                  />
                </label>
                <label className="largeField">
                  ACCESSIBILITY OR LEARNING SUPPORT{" "}
                  <small>OPTIONAL / PRIVATE</small>
                  <textarea
                    name="supportNeeds"
                    placeholder="Tell us about accommodations, scheduling needs, assistive technology, or other support."
                  />
                </label>
                <StepActions
                  back={() => move(2)}
                  next={(event) => move(4, event.currentTarget)}
                />
              </fieldset>
              <fieldset
                className={`admissionStep ${step === 4 ? "active" : ""}`}
                data-step="4"
              >
                <legend>
                  <span>05</span>
                  <div>
                    <small>FINAL REVIEW</small>
                    <b>Application certification</b>
                    <p>
                      Confirm the information and authorize creation of your
                      student record.
                    </p>
                  </div>
                </legend>
                <div className="reviewSummary">
                  <div>
                    <span>ACADEMIC IDENTITY</span>
                    <b>Generated after approval</b>
                  </div>
                  <div>
                    <span>APPLICATION FEE</span>
                    <b>$0.00</b>
                  </div>
                  <div>
                    <span>FIRST TERM</span>
                    <b>120 days</b>
                  </div>
                  <div>
                    <span>DELIVERY</span>
                    <b>100% online</b>
                  </div>
                </div>
                <label className="checkField">
                  <input name="acceptPolicies" type="checkbox" required />
                  <span>
                    <b>Accuracy and academic integrity</b>I certify that this
                    application is accurate and complete. I understand that
                    admission requires the electronic signature in the next
                    section.
                  </span>
                </label>
                <div className="finalSubmit">
                  <button type="button" onClick={() => move(3)}>
                    ← BACK
                  </button>
                  <div>
                    <small>FINAL CONFIRMATION REQUIRED</small>
                    <p>
                      You will review one final confirmation before the
                      application is transmitted.
                    </p>
                  </div>
                  <button type="button" className="submitApplication" onClick={(event) => move(5, event.currentTarget)}>
                    CONTINUE TO POLICIES →
                  </button>
                </div>
              </fieldset>
              <fieldset className={`admissionStep ${step === 5 ? "active" : ""}`} data-step="5">
                <legend><span>06</span><div><small>REQUIRED ELECTRONIC RECORD</small><b>Policies and electronic signature</b><p>Open, review, and acknowledge the exact published version of every required document.</p></div></legend>
                {policies.length === 0 ? <div className="grantPreview"><div><small>ADMISSIONS PAUSED</small><strong>LEGAL REVIEW IN PROGRESS</strong><span>The policy bundle must be published before an account can be created.</span></div></div> : <div className="policyAcceptanceList">
                  {policies.map((policy, index) => {
                    const reviewed = reviewedPolicies.includes(policy.version.id);
                    return <label className="checkField" key={policy.id}><input name={`policy_${policy.version.id}`} type="checkbox" required disabled={!reviewed} /><span><b>{String(index + 1).padStart(2, "0")} · {policy.title} · Version {policy.version.number}</b>{policy.summary}<Link href={`/policies/${policy.slug}`} target="_blank" onClick={() => setReviewedPolicies((current) => current.includes(policy.version.id) ? current : [...current, policy.version.id])}>Open and review document ↗</Link><small>Effective {policy.version.effectiveAt ? new Date(policy.version.effectiveAt).toLocaleDateString() : "upon publication"} · SHA-256 {policy.version.checksum}</small></span></label>;
                  })}
                </div>}
                <label className="checkField"><input name="ageAttested" type="checkbox" required /><span><b>Adult eligibility</b>I attest that I am at least 18 years old and legally able to enter this agreement.</span></label>
                <label className="largeField">TYPE YOUR APPLICATION NAME TO SIGN<input name="signerName" required placeholder="Your full legal or public name" /><small>Your typed name must match the name entered in Section 01.</small></label>
                <label className="checkField"><input name="electronicConsent" type="checkbox" required /><span><b>Intent to sign and receive records electronically</b>I consent to electronic policies, signatures, notices, academic records, and retainable HTML receipts and intend this typed signature to be legally effective.</span></label>
                <div className="reviewSummary"><div><span>DOCUMENTS</span><b>{policies.length} mandatory policies</b></div><div><span>VERSIONS</span><b>Exact checksums recorded</b></div><div><span>STUDENT RESPONSIBILITY</span><b>$0.00</b></div><div><span>RECORD</span><b>Retainable HTML receipt</b></div></div>
                <div className="finalSubmit"><button type="button" onClick={() => move(4)}>← BACK</button><div><small>FINAL CONFIRMATION REQUIRED</small><p>The server verifies that every signed version is still current before creating your account.</p></div><button className="submitApplication" disabled={busy || policies.length !== 8}>{busy ? "CREATING YOUR STUDENT RECORD…" : "REVIEW SIGNED SUBMISSION →"}</button></div>
              </fieldset>
            </motion.div>
          </AnimatePresence>
        </form>
      </div>
      <footer className="admissionsFooter">
        <span>THUNDER BUDDIES STUDIOS</span>
        <i>×</i>
        <span>BLACK RIDGE STUDIOS</span>
        <small>
          Enfusion University is an independent, non-accredited learning
          institution. <Link href="/policies">Policy Center</Link>
        </small>
      </footer>
      <AnimatePresence>
        {pendingApplication && (
          <motion.div
            className="submissionConfirmation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="submission-confirmation-title"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.28 }}
            >
              <Image
                src="/enfusion-university-lockup.png"
                alt="Enfusion University"
                width={1600}
                height={388}
              />
              <small>FINAL APPLICATION CONFIRMATION</small>
              <h2 id="submission-confirmation-title">
                Ready to submit your application?
              </h2>
              <p>
                This is the final step. Enfusion University will create your
                tracking number, evaluate your application, and issue your
                student record after a successful decision.
              </p>
              <div>
                <span>
                  <b>APPLICATION STATUS</b>Ready for submission
                </span>
                <span>
                  <b>STUDENT RESPONSIBILITY</b>$0.00
                </span>
              </div>
              <footer>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPendingApplication(null)}
                >
                  Return to review
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void confirmSubmission()}
                >
                  {busy ? "Submitting securely…" : "Confirm and submit →"}
                </button>
              </footer>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function StepActions({
  first = false,
  back,
  next,
}: {
  first?: boolean;
  back?: () => void;
  next: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <footer className="stepActions">
      {first ? (
        <span>ESTIMATED TIME · 8–12 MINUTES</span>
      ) : (
        <button type="button" onClick={back}>
          ← BACK
        </button>
      )}
      <div>
        <small>YOUR PROGRESS SAVES WHILE THIS PAGE REMAINS OPEN</small>
        <button type="button" onClick={next}>
          CONTINUE →
        </button>
      </div>
    </footer>
  );
}

function AwardDecision({ award, enter }: { award: Award; enter: () => void }) {
  return (
    <main className="awardPage">
      <div className="admissionsAurora" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <motion.section
        className="awardDecision"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <header>
          <div className="awardLogo">
            <Image
              src="/enfusion-university-lockup.png"
              alt="Enfusion University"
              width={1600}
              height={388}
            />
          </div>
          <div>
            <p>OFFICE OF ADMISSIONS</p>
            <strong>ADMISSIONS + SPONSORSHIP DECISION</strong>
          </div>
          <span>ADMITTED</span>
        </header>
        <div className="awardHero">
          <p>WELCOME TO THE CLASS OF 2026</p>
          <h1>
            Your application is approved
            <br />
            <em>and fully sponsored.</em>
          </h1>
          <span>
            Your academic identity and Thunder Buddies Studios Sponsored
            Learning Grant are active immediately.
          </span>
        </div>
        <div className="awardIdentity">
          <div>
            <small>EFU CAMPUS IDENTITY</small>
            <strong>{award.academicIdentity}</strong>
            <span>Internal login identifier · not an internet mailbox</span>
          </div>
          <div>
            <small>STUDENT NUMBER</small>
            <strong>{award.studentNumber}</strong>
            <span>Permanent learner-record identifier</span>
          </div>
        </div>
        <section className="awardStatement">
          <header>
            <h2>Sponsored learning statement</h2>
            <code>AUTO-GRANT / APPROVED</code>
          </header>
          {award.breakdown.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <b>{money(item.amountCents)}</b>
            </div>
          ))}
          <div className="statementTotal">
            <span>ESTIMATED PROGRAM SERVICE VALUE</span>
            <b>{money(award.estimatedProgramValueCents)}</b>
          </div>
          <div className="statementGrant">
            <span>SPONSORED LEARNING GRANT APPLIED</span>
            <b>− {money(award.grantAwardCents)}</b>
          </div>
          <div className="statementDue">
            <span>STUDENT RESPONSIBILITY</span>
            <b>{money(award.studentDueCents)}</b>
          </div>
        </section>
        <section className="grantBalance">
          <div>
            <small>AVAILABLE FOR FUTURE COURSE ALLOCATIONS</small>
            <strong>{money(award.availableGrantBalanceCents)}</strong>
            <span>NONCASH SPONSORED-LEARNING BALANCE</span>
          </div>
          <p>
            Every course allocation and automatic renewal will appear in your
            student Funding Center. This platform does not charge students.
          </p>
        </section>
        <p className="awardDisclosure">{award.disclosure}</p>
        <button onClick={enter}>ENTER YOUR CAMPUS →</button>
      </motion.section>
    </main>
  );
}
