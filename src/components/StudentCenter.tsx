"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./StudentCenter.module.css";

type Enrollment = {
  id: string;
  status: string;
  progress: number;
  enrolledAt: string;
  withdrawnAt: string | null;
  refundCents: number;
  course: {
    id: string;
    code: string;
    title: string;
    academy: string;
    serviceValueCents: number;
    estimatedDays: number;
  };
};
type Grade = {
  id: string;
  totalScore: number;
  confidence: number;
  status: string;
  createdAt: string;
  submission: {
    status: string;
    course: { code: string; title: string };
    appeals: { status: string }[];
  };
};
type TrackedApplication = {
  id: string;
  trackingNumber: string;
  type: string;
  status: string;
  outcome: string | null;
  submittedAt: string;
  closedAt: string | null;
  statusHistory: { status: string; detail?: string | null; at: string }[];
  programApplication: { program: { code: string; title: string } } | null;
  studentApplication: { status: string } | null;
};
type CenterData = {
  balanceCents: number;
  standing: {
    finalizedGradeCount: number;
    gradeAverage: number;
    withdrawalCount: number;
    withdrawalPenaltyBps: number;
    gradePenaltyBps: number;
    renewalMultiplierBps: number;
    status: string;
    academicHold: boolean;
    ownerOverrideMultiplierBps: number | null;
  };
  enrollments: Enrollment[];
  grades: Grade[];
  applications: TrackedApplication[];
  policy: {
    name: string;
    minimumRenewalPercent: number;
    continuingGrade: number;
    gradeReviewMinimum: number;
    timeTiers: { throughHours: number | null; refundPercent: number }[];
    progressTiers: { throughPercent: number; refundPercent: number }[];
  };
};
type WithdrawalQuote = {
  refundPercent: number;
  refundCents: number;
  allocatedCents: number;
  penaltyPercent: number;
  elapsedHours: number;
  progress: number;
  explanation: string;
};
type Recommendation = {
  courseCode: string;
  rank: number;
  reason: string;
  readiness: string;
  weeklyPlan: string;
  course?: {
    id: string;
    code: string;
    title: string;
    academy: string;
    level: string;
    estimatedDays: number;
    workloadHours: number;
    faculty?: {
      name: string;
      title: string;
      initials: string;
      specialty: string;
      voice: string;
    };
    prerequisites: { prerequisite: { code: string; title: string } }[];
  };
};

const questions = [
  {
    question: "What do you most want to build?",
    options: [
      "My first complete mod",
      "Gameplay systems",
      "Enforce Script systems",
      "Terrain and worlds",
      "Vehicles or weapons",
      "UI, audio, animation, or VFX",
    ],
  },
  {
    question: "How much Arma Reforger modding experience do you have?",
    options: [
      "None yet",
      "A few tutorials",
      "One working project",
      "Several published projects",
    ],
  },
  {
    question: "How comfortable are you in Enfusion Workbench?",
    options: [
      "I have not opened it",
      "I know the basic panels",
      "I can build and debug resources",
      "I use advanced tools confidently",
    ],
  },
  {
    question: "How comfortable are you with programming?",
    options: [
      "No programming experience",
      "Basic logic",
      "I can edit Enforce Script",
      "I can design and debug systems",
    ],
  },
  {
    question: "Which learning style fits you best?",
    options: [
      "Guided step-by-step labs",
      "Small experiments",
      "One focused technical build",
      "Independent capstone work",
    ],
  },
  {
    question: "How many hours can you study each week?",
    options: ["2–4 hours", "5–7 hours", "8–12 hours", "13+ hours"],
  },
  {
    question: "What course pace do you want first?",
    options: [
      "5-day foundation",
      "10-day standard",
      "15-day advanced",
      "20-day capstone",
    ],
  },
  {
    question: "How do you want to work?",
    options: [
      "Solo until confident",
      "Mostly solo with feedback",
      "Studio team",
      "Lead a collaborative build",
    ],
  },
  {
    question: "What evidence do you want to finish with?",
    options: [
      "A documented practice artifact",
      "A playable demo",
      "A Workshop release",
      "A portfolio capstone",
    ],
  },
  {
    question: "What is your biggest current obstacle?",
    options: [
      "I do not know where to start",
      "Workbench setup and resources",
      "Scripting and debugging",
      "Finishing and publishing",
      "Advanced replication or performance",
    ],
  },
];
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);

export function StudentCenter() {
  const [section, setSection] = useState<"overview" | "academic" | "applications" | "enrollment" | "advising">(() => {
    if (typeof window === "undefined") return "overview";
    const value = new URLSearchParams(window.location.search).get("center");
    return ["overview", "academic", "applications", "enrollment", "advising"].includes(value || "") ? value as "overview" | "academic" | "applications" | "enrollment" | "advising" : "overview";
  });
  const [data, setData] = useState<CenterData | null>(null);
  const [withdrawing, setWithdrawing] = useState<Enrollment | null>(null);
  const [withdrawalQuote, setWithdrawalQuote] =
    useState<WithdrawalQuote | null>(null);
  const [message, setMessage] = useState("");
  const [answers, setAnswers] = useState<string[]>(Array(10).fill(""));
  const [question, setQuestion] = useState(0);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [advisorSummary, setAdvisorSummary] = useState("");
  const [advisorBusy, setAdvisorBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/university/student-center");
    const result = await response.json();
    if (response.ok) setData(result);
    else setMessage(result.error);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  const active = useMemo(
    () => data?.enrollments.filter((item) => item.status === "ACTIVE") || [],
    [data],
  );
  const withdrawn = useMemo(
    () => data?.enrollments.filter((item) => item.status === "WITHDRAWN") || [],
    [data],
  );
  async function askAdvisor() {
    setAdvisorBusy(true);
    setMessage("");
    const response = await fetch("/api/university/course-advisor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        answers: questions.map((item, index) => ({
          question: item.question,
          answer: answers[index],
        })),
      }),
    });
    const result = await response.json();
    setAdvisorBusy(false);
    if (!response.ok) {
      setMessage(result.error);
      return;
    }
    setRecommendations(result.recommendations);
    setAdvisorSummary(result.summary);
    setQuestion(10);
  }
  async function enroll(courseId: string) {
    if (
      !confirm(
        "This is your final enrollment confirmation. Apply sponsored funding and enroll in this course?",
      )
    )
      return;
    const response = await fetch("/api/academy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "enroll_course", courseId }),
    });
    const result = await response.json();
    setMessage(
      response.ok
        ? "Enrollment confirmed. Your course is now available in Learning."
        : result.error,
    );
    if (response.ok) {
      setRecommendations([]);
      await load();
    }
  }
  async function withdraw(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!withdrawing) return;
    const reason = String(
      new FormData(event.currentTarget).get("reason") || "",
    );
    const response = await fetch("/api/university/student-center", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "withdraw",
        enrollmentId: withdrawing.id,
        reason,
      }),
    });
    const result = await response.json();
    setMessage(
      response.ok
        ? `${withdrawing.course.code} was withdrawn. ${money(result.enrollment.refundCents)} returned to your sponsored account.`
        : result.error,
    );
    if (response.ok) {
      setWithdrawing(null);
      await load();
    }
  }
  async function openWithdrawal(enrollment: Enrollment) {
    setWithdrawing(enrollment);
    setWithdrawalQuote(null);
    const response = await fetch("/api/university/student-center", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "quote_withdrawal",
        enrollmentId: enrollment.id,
      }),
    });
    const result = await response.json();
    if (response.ok) setWithdrawalQuote(result.quote);
    else {
      setWithdrawing(null);
      setMessage(result.error);
    }
  }
  if (!data)
    return (
      <div className={styles.loading}>
        <i />
        <span>{message || "OPENING STUDENT CENTER"}</span>
      </div>
    );
  const renewalPercent = data.standing.renewalMultiplierBps / 100;
  return (
    <section className={styles.center} data-center-section={section}>
      <header className={styles.hero}>
        <div>
          <p>ACADEMIC SERVICES / ONE STOP</p>
          <h1>Your Student Center</h1>
          <span>
            Manage course decisions, academic standing, advising, and
            continuing-study sponsorship from one transparent record.
          </span>
        </div>
        <aside>
          <small>AVAILABLE SPONSORED BALANCE</small>
          <b>{money(data.balanceCents)}</b>
          <span>Student responsibility · $0.00</span>
        </aside>
      </header>
      <nav className={styles.centerNav} aria-label="Student Center sections">
        {[
          ["overview", "Overview", "Today and priorities"],
          ["academic", "Academic record", "Standing and results"],
          ["applications", "Applications", "Tracking and decisions"],
          ["enrollment", "Enrollment", "Courses and withdrawals"],
          ["advising", "Advising", "Plan your next course"],
        ].map(([id, label, detail]) => <button className={section === id ? styles.centerNavActive : ""} key={id} onClick={() => { const next = id as typeof section; setSection(next); window.history.replaceState(null, "", `/university?view=student-center&center=${next}`); }}><b>{label}</b><span>{detail}</span></button>)}
        <a href="/university?view=messages"><b>Faculty messages</b><span>Your support network</span></a>
      </nav>
      {message && (
        <div className={styles.message}>
          {message}
          <button onClick={() => setMessage("")}>×</button>
        </div>
      )}
      <div className={styles.standingGrid}>
        <article>
          <small>ACADEMIC STANDING</small>
          <b>{data.standing.status.replaceAll("_", " ")}</b>
          <span>
            {data.standing.academicHold
              ? "New funding is paused pending support or appeal."
              : "Continuing sponsorship remains active."}
          </span>
        </article>
        <article>
          <small>FINALIZED GRADE AVERAGE</small>
          <b>
            {data.standing.finalizedGradeCount
              ? `${data.standing.gradeAverage.toFixed(1)}%`
              : "—"}
          </b>
          <span>
            {data.standing.finalizedGradeCount} finalized assessment
            {data.standing.finalizedGradeCount === 1 ? "" : "s"}
          </span>
        </article>
        <article>
          <small>NEXT-TERM AWARD RATE</small>
          <b>{renewalPercent}%</b>
          <span>
            {data.standing.withdrawalPenaltyBps / 100}% withdrawal adjustment ·{" "}
            {data.standing.gradePenaltyBps / 100}% grade adjustment
          </span>
        </article>
        <article>
          <small>COURSE WITHDRAWALS</small>
          <b>{data.standing.withdrawalCount}</b>
          <span>
            Only actual policy penalties accumulate, with a 25-point maximum.
          </span>
        </article>
      </div>
      <section className={styles.applicationTracker}>
        <header>
          <div>
            <small>APPLICATION SERVICES</small>
            <h2>Application tracker</h2>
            <p>
              Use the permanent tracking number when asking about an admission
              or academic-program decision.
            </p>
          </div>
          <span>
            {
              data.applications.filter((item) => item.status !== "CLOSED")
                .length
            }{" "}
            OPEN
          </span>
        </header>
        <div>
          {data.applications.map((item) => (
            <article key={item.id}>
              <div className={styles.trackingNumber}>
                <small>TRACKING NUMBER</small>
                <b>{item.trackingNumber}</b>
                <span>
                  {item.type === "ADMISSION"
                    ? "UNIVERSITY ADMISSION"
                    : item.programApplication?.program.title ||
                      "PROGRAM APPLICATION"}
                </span>
              </div>
              <div className={styles.trackingLine}>
                {item.statusHistory.map((event, index) => (
                  <span
                    className={
                      index === item.statusHistory.length - 1
                        ? styles.current
                        : ""
                    }
                    key={`${event.status}-${event.at}`}
                  >
                    <i />
                    <b>{event.status.replaceAll("_", " ")}</b>
                    <small>{new Date(event.at).toLocaleDateString()}</small>
                  </span>
                ))}
              </div>
              <aside data-status={item.status}>
                <small>{item.status}</small>
                <b>{item.outcome || "Decision pending"}</b>
                {item.closedAt && (
                  <time>
                    Closed {new Date(item.closedAt).toLocaleDateString()}
                  </time>
                )}
              </aside>
            </article>
          ))}
          {!data.applications.length && (
            <p className={styles.empty}>
              Application tracking records will appear after submission.
            </p>
          )}
        </div>
      </section>
      <section className={styles.advisor}>
        <header>
          <div>
            <small>BEFORE YOU ENROLL</small>
          <h2>Meet Dr. Elara Voss, your university advisor</h2>
            <p>
              Answer ten questions. Dr. Voss will compare your goals, readiness,
              time, and prerequisites to the live 192-course catalog.
              Recommendations never enroll you automatically.
            </p>
          </div>
          <div className={styles.bot}>
            <i />
            <b>EV</b>
            <span>
              {recommendations.length
                ? "PATH READY"
                : `QUESTION ${Math.min(question + 1, 10)} / 10`}
            </span>
          </div>
        </header>
        {!recommendations.length && (
          <div className={styles.interview}>
            <div className={styles.questionTrack}>
              <i style={{ width: `${question * 10}%` }} />
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={question}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <small>ORBIT ASKED</small>
                <h3>{questions[question].question}</h3>
                <div className={styles.options}>
                  {questions[question].options.map((option) => (
                    <button
                      className={
                        answers[question] === option ? styles.selected : ""
                      }
                      key={option}
                      onClick={() =>
                        setAnswers((current) =>
                          current.map((value, index) =>
                            index === question ? option : value,
                          ),
                        )
                      }
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <footer>
                  <button
                    disabled={!question}
                    onClick={() => setQuestion((value) => value - 1)}
                  >
                    ← PREVIOUS
                  </button>
                  {question < 9 ? (
                    <button
                      disabled={!answers[question]}
                      onClick={() => setQuestion((value) => value + 1)}
                    >
                      NEXT QUESTION →
                    </button>
                  ) : (
                    <button
                      disabled={!answers.every(Boolean) || advisorBusy}
                      onClick={askAdvisor}
                    >
                      {advisorBusy
                        ? "ANALYZING 192 COURSES…"
                        : "BUILD MY COURSE PATH →"}
                    </button>
                  )}
                </footer>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
        {!!recommendations.length && (
          <div className={styles.results}>
            <div className={styles.advisorNote}>
              <b>
                PERSONALIZED FACULTY COURSE MATCH
              </b>
              <p>{advisorSummary}</p>
              <button
                onClick={() => {
                  setRecommendations([]);
                  setQuestion(0);
                }}
              >
                RETAKE INTERVIEW
              </button>
            </div>
            {recommendations.map(
              (item) =>
                item.course && (
                  <article key={item.courseCode}>
                    <span>0{item.rank}</span>
                    <div>
                      <small>
                        {item.course.academy} / {item.course.level}
                      </small>
                      <h3>
                        {item.course.code} · {item.course.title}
                      </h3>
                      <p>{item.reason}</p>
                      {item.course.faculty && (
                        <div className={styles.recommendationFaculty}>
                          <b>{item.course.faculty.initials}</b>
                          <span>
                            <small>COURSE FACULTY</small>
                            <strong>{item.course.faculty.name}</strong>
                            <em>{item.course.faculty.voice}</em>
                          </span>
                        </div>
                      )}
                      <div>
                        <i>{item.readiness}</i>
                        <i>{item.weeklyPlan}</i>
                      </div>
                      {item.course.prerequisites.length > 0 && (
                        <em>
                          PREREQUISITES ·{" "}
                          {item.course.prerequisites
                            .map((entry) => entry.prerequisite.code)
                            .join(", ")}
                        </em>
                      )}
                    </div>
                    <button onClick={() => enroll(item.course!.id)}>
                      REVIEW & CONFIRM ENROLLMENT →
                    </button>
                  </article>
                ),
            )}
          </div>
        )}
      </section>
      <div className={styles.records}>
        <section>
          <header>
            <small>COURSE SERVICES</small>
            <h2>Current enrollments</h2>
            <span>{active.length} ACTIVE</span>
          </header>
          {active.map((item) => (
            <article className={styles.enrollment} key={item.id}>
              <div className={styles.progress}>
                <b>{item.progress}%</b>
                <i
                  style={
                    {
                      "--course-progress": `${item.progress}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
              <div>
                <small>
                  {item.course.code} / {item.course.academy}
                </small>
                <h3>{item.course.title}</h3>
                <span>
                  {item.course.estimatedDays} days · sponsored value{" "}
                  {money(item.course.serviceValueCents)}
                </span>
              </div>
              <button onClick={() => void openWithdrawal(item)}>
                GET WITHDRAWAL QUOTE
              </button>
            </article>
          ))}
          {!active.length && (
            <p className={styles.empty}>
              No active courses. Complete the advisor interview before selecting
              your next course.
            </p>
          )}
        </section>
        <aside>
          <header>
            <small>CONTINUATION POLICY</small>
            <h2>How funding continues</h2>
          </header>
          <ol>
            <li>
              <b>70% or higher</b>
              <span>
                After at least two finalized grades, sponsorship continues
                without a grade reduction.
              </span>
            </li>
            <li>
              <b>Below 70%</b>
              <span>
                New awards pause for academic support. Active assessment exceptions and
                appeals are excluded.
              </span>
            </li>
            <li>
              <b>Withdrawals</b>
              <span>
                Within 24 hours the full allocation returns without penalty.
                Later quotes use the lower time and progress tier.
              </span>
            </li>
            <li>
              <b>Recovery</b>
              <span>
                Improved finalized grades remove grade reductions. Owners can
                document a support override.
              </span>
            </li>
          </ol>
        </aside>
      </div>
      {!!withdrawn.length && (
        <section className={styles.history}>
          <header>
            <small>ACADEMIC HISTORY</small>
            <h2>Withdrawn courses</h2>
          </header>
          {withdrawn.map((item) => (
            <div key={item.id}>
              <span>
                {item.course.code} · {item.course.title}
              </span>
              <b>+{money(item.refundCents)} returned</b>
              <time>
                {item.withdrawnAt
                  ? new Date(item.withdrawnAt).toLocaleDateString()
                  : "Recorded"}
              </time>
            </div>
          ))}
        </section>
      )}
      {!!data.grades.length && (
        <section className={styles.history}>
          <header>
            <small>FINALIZED ASSESSMENT RECORD</small>
            <h2>Funding-eligible grades</h2>
          </header>
          {data.grades.map((grade) => {
            const appeal = grade.submission.appeals[0];
            const frozen =
              grade.status !== "AUTO_FINALIZED" ||
              ["SUBMITTED", "IN_REVIEW"].includes(appeal?.status || "");
            return (
              <div key={grade.id}>
                <span>
                  {grade.submission.course.code} ·{" "}
                  {grade.submission.course.title}
                </span>
                <b>
                  {frozen
                    ? "EXCLUDED PENDING REVIEW"
                    : `${grade.totalScore}% FINALIZED`}
                </b>
                <time>{new Date(grade.createdAt).toLocaleDateString()}</time>
              </div>
            );
          })}
        </section>
      )}
      <AnimatePresence>
        {withdrawing && (
          <motion.div
            className={styles.modalBack}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.form
              className={styles.modal}
              onSubmit={withdraw}
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
            >
              <button type="button" onClick={() => setWithdrawing(null)}>
                ×
              </button>
              <small>LIVE WITHDRAWAL QUOTE</small>
              <h2>
                {withdrawing.course.code} · {withdrawing.course.title}
              </h2>
              {withdrawalQuote ? (
                <>
                  <p>
                    <b>{money(withdrawalQuote.refundCents)}</b> (
                    {withdrawalQuote.refundPercent}%) returns to your noncash
                    sponsored account. Renewal impact:{" "}
                    {withdrawalQuote.penaltyPercent} percentage points.
                  </p>
                  <dl>
                    <div>
                      <dt>Enrollment age</dt>
                      <dd>{withdrawalQuote.elapsedHours} hours</dd>
                    </div>
                    <div>
                      <dt>Course progress</dt>
                      <dd>{withdrawalQuote.progress}%</dd>
                    </div>
                    <div>
                      <dt>Original allocation</dt>
                      <dd>{money(withdrawalQuote.allocatedCents)}</dd>
                    </div>
                  </dl>
                  <p>
                    {withdrawalQuote.explanation} The quote is recalculated when
                    you confirm.
                  </p>
                </>
              ) : (
                <p>
                  Calculating the effective policy, elapsed time, and course
                  progress…
                </p>
              )}
              <label>
                WHY ARE YOU WITHDRAWING?
                <textarea
                  name="reason"
                  required
                  minLength={10}
                  placeholder="This helps academic support understand schedule, readiness, or course-fit needs."
                />
              </label>
              <div>
                <button type="button" onClick={() => setWithdrawing(null)}>
                  KEEP COURSE
                </button>
                <button disabled={!withdrawalQuote}>CONFIRM WITHDRAWAL</button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
