"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Enrollment = { id: string; status: string; progress: number };
type Course = { id: string; code: string; title: string; summary: string; deliverable: string; studio: string; level: string; status: string; learningCredits: number; enrollments: Enrollment[]; _count: { enrollments: number; submissions: number } };
type Submission = { id: string; title: string; summary: string; referenceUrl: string | null; demoUrl: string | null; status: string; feedback: string | null; submittedAt: string; course: { code: string; title: string; studio: string; learningCredits: number }; student: { id: string; name: string; email: string }; reviewer: { name: string } | null; certificate: Certificate | null };
type Certificate = { id: string; credentialCode: string; title: string; issuer: string; learningCredits: number; issuedAt: string; course?: { code: string; title: string; studio: string } };
type Program = { id: string; code: string; title: string; summary: string; level: string; creditsRequired: number; sponsoredBy: string; enrollments: { id: string; status: string; creditsEarned: number }[] };
type AcademyData = { courses: Course[]; submissions: Submission[]; certificates: Certificate[]; programs: Program[]; learningCredits: number; canReview: boolean; viewerId: string };

export function Academy({ initialTab = "catalog", context = "valoris" }: { initialTab?: "catalog" | "programs" | "submissions" | "credentials" | "review"; context?: "valoris" | "university" }) {
  const [data, setData] = useState<AcademyData | null>(null);
  const [tab, setTab] = useState<"catalog" | "programs" | "submissions" | "credentials" | "review">(initialTab);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [submitCourse, setSubmitCourse] = useState<Course | null>(null);
  const [authoring, setAuthoring] = useState(false);

  async function load() {
    const response = await fetch("/api/academy", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Academy records are unavailable."); return; }
    setData(result);
  }

  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, []);

  async function act(action: string, payload: Record<string, unknown>) {
    const enrollmentAction = action === "enroll_course" || action === "enroll_program";
    if (enrollmentAction && !confirm("Confirm enrollment now? Sponsored-learning values are internal noncash service allocations, not tuition, financial aid, cash, loans, or debt; student responsibility remains $0.00. Course withdrawals within 24 hours restore 100% unless final work was submitted. Later restoration uses the lower time-and-progress tier and may affect future renewal rates.")) return false;
    setBusy(`${action}:${String(payload.courseId || payload.programId || "new")}`); setError("");
    const response = await fetch("/api/academy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...payload, ...(enrollmentAction ? { fundingAcknowledged: true, refundPolicyAcknowledged: true } : {}) }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Unable to complete that request."); setBusy(""); return false; }
    await load(); setBusy(""); return true;
  }

  const reviewQueue = useMemo(() => data?.submissions.filter((submission) => ["SUBMITTED", "AI_EXCEPTION", "APPEALED", "IN_REVIEW"].includes(submission.status)) || [], [data]);
  if (!data) return <section className="academyLoading"><i/><p>{error || "Opening the VALORIS learning network…"}</p></section>;

  const university = context === "university";
  return <div className="academy">
    <section className="academyHero">
      <div><p className="kicker">{university ? "ENFUSION UNIVERSITY / ONLINE CAMPUS" : "PROJECT VALORIS / DEVELOPMENT ACADEMY"}</p><h2>{university ? <>Your education.<br/><em>Built in practice.</em></> : <>Learn by building.<br/><em>Advance by shipping.</em></>}</h2><p>{university ? "A professional student experience for course enrollment, assessed mod assignments, studio feedback, academic pathways, and permanent learner records." : "Studio-authored courses turn real Arma Reforger mods into reviewed portfolio work, community credentials, and progressive learning pathways."}</p></div>
      <aside><span>ACADEMIC RECORD</span><strong>{data.learningCredits}</strong><small>COMMUNITY LEARNING CREDITS</small><div><b>{data.certificates.length}</b> credentials earned</div></aside>
    </section>
    <nav className="academyTabs" aria-label="Academy sections">
      <button className={tab === "catalog" ? "on" : ""} onClick={() => setTab("catalog")}>COURSE CATALOG</button>
      <button className={tab === "programs" ? "on" : ""} onClick={() => setTab("programs")}>PROGRAMS</button>
      <button className={tab === "submissions" ? "on" : ""} onClick={() => setTab("submissions")}>MY SUBMISSIONS</button>
      <button className={tab === "credentials" ? "on" : ""} onClick={() => setTab("credentials")}>CREDENTIALS</button>
      {data.canReview && <button className={tab === "review" ? "on" : ""} onClick={() => setTab("review")}>STUDIO REVIEW <b>{reviewQueue.length}</b></button>}
    </nav>
    {error && <p className="academyError">△ {error}</p>}

    {tab === "catalog" && <>
      <header className="academySectionHead"><div><span>01</span><h3>STUDIO COURSE CATALOG</h3></div>{data.canReview && <button onClick={() => setAuthoring(true)}>＋ AUTHOR COURSE</button>}</header>
      <div className="courseGrid">{data.courses.filter((course) => course.status === "PUBLISHED" || data.canReview).map((course) => {
        const enrollment = course.enrollments[0];
        return <article className="courseCard" key={course.id}><header><span>{course.level}</span><code>{course.code}</code></header><p className="courseStudio">{course.studio}</p><h3>{course.title}</h3><p>{course.summary}</p><div className="deliverable"><small>ASSESSED DELIVERABLE</small>{course.deliverable}</div><footer><span>{course.learningCredits} CREDITS</span><span>{course._count.enrollments} ENROLLED</span></footer>{!enrollment ? <button disabled={busy.includes(course.id)} onClick={() => void act("enroll_course", { courseId: course.id })}>ENROLL IN COURSE →</button> : enrollment.status === "COMPLETED" ? <button disabled>✓ COURSE COMPLETED</button> : <button onClick={() => setSubmitCourse(course)}>SUBMIT MOD FOR REVIEW →</button>}</article>;
      })}</div>
    </>}

    {tab === "programs" && <><header className="academySectionHead"><div><span>02</span><h3>VALORIS ACADEMIC PATHWAYS</h3></div></header><div className="programGrid">{data.programs.map((program) => { const enrollment = program.enrollments[0]; const earned = enrollment?.creditsEarned ?? data.learningCredits; const progress = Math.min(100, Math.round((earned / program.creditsRequired) * 100)); return <article className="programCard" key={program.id}><header><span>{program.level.replace("_", " ")}</span><code>{program.code}</code></header><h3>{program.title}</h3><p>{program.summary}</p><div className="programProgress"><span><small>PROGRESS</small><b>{earned} / {program.creditsRequired} credits</b></span><i><b style={{ width: `${progress}%` }}/></i></div><footer><small>SPONSORED BY</small>{program.sponsoredBy}</footer>{enrollment ? <button disabled>{enrollment.status === "COMPLETED" ? "✓ PATH COMPLETED" : "PATH ACTIVE"}</button> : <button disabled={busy.includes(program.id)} onClick={() => void act("enroll_program", { programId: program.id })}>DECLARE THIS PATH →</button>}</article>; })}</div></>}

    {tab === "submissions" && <><header className="academySectionHead"><div><span>03</span><h3>MOD REVIEW RECORD</h3></div></header><div className="submissionList">{data.submissions.filter((submission) => submission.student.id === data.viewerId).map((submission) => <SubmissionRow submission={submission} key={submission.id}/>)}</div>{!data.submissions.some((submission) => submission.student.id === data.viewerId) && <AcademyEmpty text="Enroll in a course and submit your first assessed mod."/>}</>}

    {tab === "credentials" && <><header className="academySectionHead"><div><span>04</span><h3>VERIFIED CREDENTIAL WALLET</h3></div></header><div className="credentialGrid">{data.certificates.map((certificate) => <Link className="credentialCard" href={`/credentials/${certificate.credentialCode}`} key={certificate.id}><span>PROJECT VALORIS</span><b>V</b><small>CERTIFICATE OF COMPLETION</small><h3>{certificate.title}</h3><p>{certificate.issuer}</p><footer><code>{certificate.credentialCode}</code><strong>{certificate.learningCredits} CREDITS ↗</strong></footer></Link>)}</div>{!data.certificates.length && <AcademyEmpty text="Approved course submissions will issue verifiable credentials here."/>}</>}

    {tab === "review" && data.canReview && <><header className="academySectionHead"><div><span>05</span><h3>STUDIO ASSESSMENT QUEUE</h3></div></header><div className="reviewList">{reviewQueue.map((submission) => <ReviewCard submission={submission} key={submission.id} onDone={load}/>)}</div>{!reviewQueue.length && <AcademyEmpty text="All submitted mods have received a studio decision."/>}</>}

    {submitCourse && <SubmissionModal course={submitCourse} close={() => setSubmitCourse(null)} save={async (payload) => { if (await act("submit_mod", { courseId: submitCourse.id, ...payload })) { setSubmitCourse(null); setTab("submissions"); } }}/>} 
    {authoring && <CourseModal close={() => setAuthoring(false)} save={async (payload) => { if (await act("create_course", payload)) setAuthoring(false); }}/>} 
  </div>;
}

function SubmissionRow({ submission }: { submission: Submission }) {
  return <article className="submissionRow"><span className={`submissionStatus ${submission.status.toLowerCase()}`}>{submission.status.replaceAll("_", " ")}</span><div><strong>{submission.title}</strong><small>{submission.course.code} · {submission.course.title} · {submission.student.name}</small>{submission.feedback && <p>Reviewer note: {submission.feedback}</p>}</div>{submission.referenceUrl && <a href={submission.referenceUrl} target="_blank" rel="noreferrer">REFERENCE ↗</a>}{submission.certificate && <Link href={`/credentials/${submission.certificate.credentialCode}`}>CREDENTIAL ↗</Link>}</article>;
}

function ReviewCard({ submission, onDone }: { submission: Submission; onDone: () => Promise<void> }) {
  const [feedback, setFeedback] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function decide(decision: string) { setBusy(true); setError(""); const response = await fetch(`/api/academy/submissions/${submission.id}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision, feedback }) }); const result = await response.json(); if (!response.ok) { setError(result.error || "Review failed"); setBusy(false); return; } await onDone(); }
  return <article className="reviewCard"><header><div><span>{submission.course.code}</span><h3>{submission.title}</h3><p>{submission.student.name} · {submission.student.email}</p></div>{submission.referenceUrl && <a href={submission.referenceUrl} target="_blank" rel="noreferrer">OPEN REFERENCE ↗</a>}</header><p>{submission.summary}</p><textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Assessment notes, revision requirements, or approval rationale…"/><div className="reviewActions"><span>{error}</span><button disabled={busy} onClick={() => void decide("DECLINED")}>DECLINE</button><button disabled={busy} onClick={() => void decide("REVISION_REQUIRED")}>REQUEST REVISION</button><button disabled={busy} onClick={() => void decide("APPROVED")}>APPROVE + ISSUE CREDENTIAL</button></div></article>;
}

function SubmissionModal({ course, close, save }: { course: Course; close: () => void; save: (payload: Record<string, unknown>) => Promise<void> }) {
  return <div className="modalBack" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><form className="modal" onSubmit={(event) => { event.preventDefault(); void save(Object.fromEntries(new FormData(event.currentTarget))); }}><header><div><p className="kicker">{course.code} / ASSESSED SUBMISSION</p><h2>Submit your practical artifact</h2></div><button type="button" onClick={close}>×</button></header><p>Your studio reviewer will inspect the technical brief, evidence, and optional external reference before issuing a credential. No files are hosted here.</p><label>PROJECT TITLE<input name="title" required minLength={3} autoFocus placeholder="Field Logistics Framework"/></label><label>TECHNICAL BRIEF<textarea name="summary" required minLength={30} placeholder="Explain the problem, architecture, testing approach, and what you learned…"/></label><label>WORKSHOP, WIKI, VIDEO, OR ISSUE LINK <small>OPTIONAL</small><input name="referenceUrl" type="url" placeholder="https://…"/></label><label>DEMO URL <small>OPTIONAL</small><input name="demoUrl" type="url" placeholder="https://…"/></label><div className="modalActions"><button type="button" onClick={close}>CANCEL</button><button className="primary">SEND TO STUDIO REVIEW →</button></div></form></div>;
}

function CourseModal({ close, save }: { close: () => void; save: (payload: Record<string, unknown>) => Promise<void> }) {
  return <div className="modalBack" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><form className="modal" onSubmit={(event) => { event.preventDefault(); void save(Object.fromEntries(new FormData(event.currentTarget))); }}><header><div><p className="kicker">STUDIO FACULTY / COURSE AUTHORING</p><h2>Publish a course</h2></div><button type="button" onClick={close}>×</button></header><label>STUDIO<select name="studio"><option>Thunder Buddies Studios</option><option>Black Ridge Studios</option><option>Thunder Buddies Studios + Black Ridge Studios</option></select></label><label>COURSE CODE<input name="code" required placeholder="TBS-110"/></label><label>COURSE TITLE<input name="title" required placeholder="Vehicle Systems Foundations"/></label><label>LEVEL<select name="level"><option>FOUNDATION</option><option>INTERMEDIATE</option><option>ADVANCED</option><option>CAPSTONE</option></select></label><label>LEARNING CREDITS<input name="learningCredits" type="number" min="1" max="12" defaultValue="3"/></label><label>COURSE SUMMARY<textarea name="summary" required minLength={20}/></label><label>ASSESSED MOD DELIVERABLE<textarea name="deliverable" required minLength={20}/></label><div className="modalActions"><button type="button" onClick={close}>CANCEL</button><button className="primary">PUBLISH COURSE →</button></div></form></div>;
}

function AcademyEmpty({ text }: { text: string }) { return <div className="academyEmpty"><b>V</b><span>RECORD CLEAR</span><p>{text}</p></div>; }
