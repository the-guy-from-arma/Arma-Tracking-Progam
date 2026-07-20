"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, BadgeCheck, BookOpen, Check, ChevronDown, CircleAlert, Clock3, Compass, Eye, ExternalLink, FileText, FlaskConical, Focus, Layers3, Lightbulb, ListChecks, Maximize2, Menu, Moon, Play, Printer, Save, Sparkles, Sun, Target, Wrench, X } from "lucide-react";
import { facultyForAcademy } from "@/lib/ai-faculty";
import type { StudioBlock } from "@/lib/curriculum-compiler";
import styles from "./GuidedCourseStudio.module.css";

type Media = { id: string; url: string; fileName: string; mimeType: string; width: number | null; height: number | null; caption: string | null; altText: string; sourceSection: string | null; filePageUrl: string | null };
type Source = { id: string; title: string; url: string; revisionId: string | null; sectionAnchor?: string; status: string; lastSyncedAt?: string; mediaCount?: number };
type Progress = { completed: boolean; reflection: string | null; developmentNotes: string | null; stepState: Record<string, boolean>; answerDraft: Record<string, unknown>; readingPosition: number; materiallyChangedAt: string | null };
type Lesson = { id: string; dayNumber: number; title: string; objectives: string[]; estimatedMinutes: number; blocks: StudioBlock[]; quiz: { id: string; type: string; prompt: string; options: string[]; explanation: string; version: string }; reflectionPrompt: string; version: { id: string; number: number; publishedAt: string | null; materiallyChanged: boolean } | null; sources: Source[]; media: Media[]; progress: Progress | null };
type CourseStudio = { id: string; code: string; title: string; summary: string; deliverable: string; studio: string; level: string; academy: string; estimatedDays: number; workloadHours: number; learningCredits: number; outcomes: string[]; prerequisites: { prerequisite: { id: string; code: string; title: string } }[]; enrollment: { status: string; progress: number } | null; days: Lesson[]; sources: Source[] };

const journeyIcons = [Compass, Eye, Layers3, Wrench, Target, ListChecks, FlaskConical, BadgeCheck];
function StudioDayIcon({ day }: { day: number }) { const Icon = journeyIcons[(day - 1) % journeyIcons.length]; return <Icon aria-hidden="true" />; }
function durationLabel(minutes: number) { const hours = minutes / 60; return hours >= 1 ? `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr studio` : `${minutes} min studio`; }

function useTheme() {
  const [dark, setDark] = useState(() => typeof window !== "undefined" && (localStorage.getItem("enscript-theme") === "dark" || (!localStorage.getItem("enscript-theme") && matchMedia("(prefers-color-scheme: dark)").matches)));
  function toggle() { setDark((current) => { localStorage.setItem("enscript-theme", current ? "light" : "dark"); return !current; }); }
  return { dark, toggle };
}

export function GuidedCourseStudio({ courseId, dayNumber }: { courseId: string; dayNumber?: number }) {
  const [course, setCourse] = useState<CourseStudio | null>(null);
  const [error, setError] = useState("");
  const { dark, toggle } = useTheme();
  const load = useCallback(async () => {
    const response = await fetch(dayNumber ? `/api/curriculum/${courseId}/lessons/${dayNumber}` : `/api/curriculum/${courseId}/studio`, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || "The course studio could not be opened."); return; }
    if (dayNumber) {
      const studioResponse = await fetch(`/api/curriculum/${courseId}/studio`, { cache: "no-store" });
      const studio = await studioResponse.json();
      if (studioResponse.ok) setCourse(studio.course);
      else setError(studio.error || "The course studio could not be opened.");
    } else setCourse(result.course);
  }, [courseId, dayNumber]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  if (error) return <StudioFailure message={error} />;
  if (!course) return <StudioLoading />;
  return (
    <main className={styles.shell} data-theme={dark ? "dark" : "light"}>
      <StudioHeader course={course} dark={dark} toggle={toggle} />
      {dayNumber ? <LessonReader course={course} dayNumber={dayNumber} refresh={load} /> : <CourseOverview course={course} refresh={load} />}
    </main>
  );
}

function StudioHeader({ course, dark, toggle }: { course: CourseStudio; dark: boolean; toggle: () => void }) {
  return <header className={styles.header}>
    <Link href="/university" className={styles.brand}><Image src="/enscript-university-lockup.png" alt="Enscript University" width={1983} height={793} priority /><span><b>GUIDED COURSE STUDIO</b><small>{course.code} · {course.academy}</small></span></Link>
    <nav aria-label="Course studio actions"><Link href={`/university/courses/${course.id}`}>Course overview</Link><Link href="/university?view=learning">My learning</Link><button onClick={() => window.print()} aria-label="Print this course page"><Printer size={17} /> Print</button><button onClick={toggle} aria-label={`Use ${dark ? "light" : "dark"} theme`}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button></nav>
  </header>;
}

function CourseOverview({ course, refresh }: { course: CourseStudio; refresh: () => Promise<void> }) {
  const faculty = facultyForAcademy(course.academy);
  const completed = course.days.filter((day) => day.progress?.completed).length;
  const next = course.days.find((day) => !day.progress?.completed) || course.days[0];
  const [confirm, setConfirm] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function enroll() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/academy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "enroll_course", courseId: course.id, fundingAcknowledged: true, refundPolicyAcknowledged: true }) });
    const result = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) setMessage(result.error || "Enrollment could not be completed.");
    else { setConfirm(false); await refresh(); }
  }
  return <motion.div className={styles.overview} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
    <section className={styles.courseHero}>
      <div><small>{course.level} · {course.code}</small><h1>{course.title}</h1><p>{course.summary}</p><div className={styles.heroActions}>{course.enrollment ? <Link className={styles.primaryAction} href={`/university/courses/${course.id}/lessons/${next.dayNumber}`}>{completed ? "Resume studio" : "Begin course"} <ArrowRight size={17} /></Link> : <button className={styles.primaryAction} onClick={() => setConfirm(true)}>Confirm enrollment <ArrowRight size={17} /></button>}<a href="#syllabus">Review syllabus <ChevronDown size={16} /></a></div></div>
      <aside><span>{Math.round((completed / Math.max(1, course.days.length)) * 100)}%</span><b>{completed} of {course.days.length} studios complete</b><i style={{ "--progress": `${Math.round((completed / Math.max(1, course.days.length)) * 360)}deg` } as React.CSSProperties} /></aside>
    </section>
    <section className={styles.welcome}><div className={styles.facultyPortrait}>{faculty.initials}</div><div><small>FACULTY WELCOME · {course.academy}</small><h2>A studio built around visible results.</h2><p>I’ll guide you from the first controlled Workbench change to a documented artifact you can explain and reproduce. Work one checkpoint at a time, compare what you see with the cited technical source, and record the evidence—not just the outcome.</p><b>{faculty.name}</b><span>{faculty.specialty}</span></div></section>
    <section className={styles.overviewGrid}>
      <article><small>COURSE PURPOSE</small><h2>What this studio develops</h2><ul>{course.outcomes.map((item) => <li key={item}><Check size={17} />{item}</li>)}</ul></article>
      <article><small>BEFORE YOU BEGIN</small><h2>Readiness and resources</h2><dl><div><dt>Workload</dt><dd>{course.workloadHours} hours</dd></div><div><dt>Schedule</dt><dd>{course.estimatedDays} guided days</dd></div><div><dt>Learning record</dt><dd>{course.learningCredits} credits</dd></div><div><dt>Software</dt><dd>Arma Reforger Tools · Enfusion Workbench</dd></div></dl>{course.prerequisites.length ? <ul>{course.prerequisites.map((item) => <li key={item.prerequisite.id}><BookOpen size={16} />{item.prerequisite.code} · {item.prerequisite.title}</li>)}</ul> : <p>No catalog prerequisite. Complete the readiness checks inside Day 1.</p>}</article>
    </section>
    <section className={styles.syllabusSection} id="syllabus">
      <header><div><small>YOUR COURSE JOURNEY</small><h2>Learn by building.</h2></div><p>Open a day, follow one action at a time, check the visible result, and pick up exactly where you stopped.</p></header>
      <ol className={styles.syllabus}>{course.days.map((day, index) => <motion.li key={day.id} data-complete={Boolean(day.progress?.completed)} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .3 }} transition={{ delay: Math.min(index, 5) * .04 }}>
        <div className={styles.dayIcon}>{day.progress?.completed ? <Check /> : <StudioDayIcon day={day.dayNumber} />}</div>
        <div className={styles.dayCopy}><small>DAY {String(day.dayNumber).padStart(2, "0")} <span>{durationLabel(day.estimatedMinutes)}</span></small><h3>{day.title.replace(/^[^:]+:\s*/, "")}</h3><p>{day.objectives[0]}</p></div>
        <div className={styles.dayStatus}><span>{day.progress?.completed ? "Complete" : day.dayNumber === next.dayNumber ? "Up next" : "Studio"}</span>{course.enrollment ? <Link href={`/university/courses/${course.id}/lessons/${day.dayNumber}`}>{day.progress?.completed ? "Review" : "Start"} <ArrowRight size={16} /></Link> : <button onClick={() => setConfirm(true)}>View course</button>}</div>
      </motion.li>)}</ol>
    </section>
    <section className={styles.artifact}><div><small>CULMINATING ARTIFACT</small><h2>Build, verify, and explain the finished work.</h2><p>{course.deliverable}</p></div><FlaskConical size={42} /></section>
    <section className={styles.coverage}><header><div><small>SOURCE COVERAGE</small><h2>Technical authority and revision status</h2></div><span>{course.sources.length} mapped source{course.sources.length === 1 ? "" : "s"}</span></header>{course.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.id}><div><b>{source.title}</b><small>Revision {source.revisionId || "sync pending"} · {source.status} · {source.mediaCount || 0} visual references</small></div><ExternalLink size={17} /></a>)}</section>
    <AnimatePresence>{confirm && <motion.div className={styles.modalBack} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirm(false); }}><motion.section className={styles.enrollModal} role="dialog" aria-modal="true" aria-labelledby="enroll-title" initial={{ y: 35, opacity: 0 }} animate={{ y: 0, opacity: 1 }}><button className={styles.close} onClick={() => setConfirm(false)} aria-label="Close"><X /></button><small>FINAL COURSE CONFIRMATION</small><h2 id="enroll-title">Enter {course.code}</h2><p>Your sponsored-learning account will allocate the published course value. This is an internal, noncash learning-service record; it is not tuition, financial aid, a loan, cash, or debt. Student responsibility remains $0.00.</p><div className={styles.termNotice}><b>Withdrawal terms</b><span>Within 24 hours, 100% is restored unless final work was submitted. Later restoration follows the published time-and-progress scale.</span></div><label><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />I understand the funding terminology and withdrawal policy and want to enroll now.</label><button className={styles.primaryAction} disabled={!accepted || busy} onClick={() => void enroll()}>{busy ? "Confirming…" : "Confirm and enroll"}</button>{message && <p role="alert">{message}</p>}</motion.section></motion.div>}</AnimatePresence>
  </motion.div>;
}

function LessonReader({ course, dayNumber, refresh }: { course: CourseStudio; dayNumber: number; refresh: () => Promise<void> }) {
  const lesson = course.days.find((day) => day.dayNumber === dayNumber);
  const [menu, setMenu] = useState(false);
  const [steps, setSteps] = useState<Record<string, boolean>>(() => lesson?.progress?.stepState || {});
  const [notes, setNotes] = useState(lesson?.progress?.developmentNotes || "");
  const [reflection, setReflection] = useState(lesson?.progress?.reflection || "");
  const [answer, setAnswer] = useState<string | string[]>(String(lesson?.progress?.answerDraft?.answer || ""));
  const [lab, setLab] = useState(Boolean(lesson?.progress?.stepState?.__labConfirmed));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [mediaOpen, setMediaOpen] = useState<Media | null>(null);
  const media = useMemo(() => new Map((lesson?.media || []).map((item) => [item.id, item])), [lesson]);
  if (!lesson) return <StudioFailure message="This lesson is not part of the current course." />;
  const activeLesson = lesson;
  async function save(action = "SAVE_DRAFT", stepOverride = steps, quiet = false) {
    if (!quiet) { setSaving(true); setMessage(""); }
    const response = await fetch(`/api/curriculum/${course.id}/lessons/${activeLesson.dayNumber}/progress`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, stepState: stepOverride, developmentNotes: notes, reflection, answerDraft: { answer }, answer, labConfirmed: lab, readingPosition: Math.round((scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)) * 100) }) });
    const result = await response.json().catch(() => ({}));
    if (!quiet) setSaving(false);
    setMessage(response.ok ? action === "COMPLETE" ? `Day complete · knowledge score ${result.score}%` : quiet ? "Step progress saved." : "Studio notes and checkpoints saved." : result.error || "Your work could not be saved.");
    if (response.ok && action === "COMPLETE") await refresh();
  }
  const currentIndex = course.days.findIndex((day) => day.dayNumber === dayNumber);
  const previous = course.days[currentIndex - 1]; const next = course.days[currentIndex + 1];
  const completedCount = course.days.filter((day) => day.progress?.completed).length;
  const procedure = lesson.blocks.find((block) => block.type === "PROCEDURE");
  const requirements = lesson.blocks.find((block) => block.type === "REQUIREMENTS");
  const supportingBlocks = lesson.blocks.filter((block) => !["PROCEDURE", "REQUIREMENTS"].includes(block.type));
  const requiredStepCount = procedure?.steps?.filter((step) => step.mandatory !== false).length || 0;
  const finishedStepCount = procedure?.steps?.filter((step) => steps[step.id]).length || 0;
  function updateStep(stepId: string, checked: boolean) {
    const nextSteps = { ...steps, [stepId]: checked };
    setSteps(nextSteps);
    void save("SAVE_DRAFT", nextSteps, true);
  }
  return <div className={styles.readerShell}>
    <button className={styles.mobileMenu} onClick={() => setMenu(true)}><Menu size={18} /> Course syllabus</button>
    <aside className={`${styles.readerSyllabus} ${menu ? styles.open : ""}`}><button className={styles.mobileClose} onClick={() => setMenu(false)}><X /> Close syllabus</button><Link href={`/university/courses/${course.id}`}><ArrowLeft size={15} /> Course overview</Link><div><small>{course.code}</small><h2>{course.title}</h2><span>{completedCount}/{course.days.length} days complete</span><i><b style={{ width: `${Math.round((completedCount / course.days.length) * 100)}%` }} /></i></div><nav aria-label="Course syllabus">{course.days.map((day) => <Link className={day.dayNumber === dayNumber ? styles.current : ""} data-complete={Boolean(day.progress?.completed)} key={day.id} href={`/university/courses/${course.id}/lessons/${day.dayNumber}`} onClick={() => setMenu(false)}><span>{day.progress?.completed ? <Check /> : day.dayNumber}</span><b>{day.title}</b></Link>)}</nav></aside>
    <motion.article className={styles.lessonReader} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {lesson.progress?.materiallyChangedAt && <div className={styles.updateNotice}><CircleAlert size={18} /><span><b>This lesson was updated.</b> Your earned progress remains intact. Review materially changed workflow or safety steps before continuing.</span></div>}
      <header className={styles.lessonHero}><div><small>DAY {lesson.dayNumber} OF {course.days.length} · {course.academy}</small><h1>{lesson.title.replace(/^[^:]+:\s*/, "")}</h1><p>{lesson.objectives[0]}</p></div><div className={styles.lessonMeta}><span><Clock3 size={16} /> {durationLabel(lesson.estimatedMinutes)}</span><span><ListChecks size={16} /> {finishedStepCount}/{requiredStepCount} actions</span><span><FileText size={16} /> {lesson.version ? `Version ${lesson.version.number}` : "Source-guided edition"}</span></div></header>
      <section className={styles.lessonLaunch}><div className={styles.launchMark}><Play /></div><div><small>START HERE</small><h2>Complete the actions in order.</h2><p>Workbench stays open beside this page. Finish one action, confirm what changed, then move to the next.</p></div>{requirements?.items?.length ? <ul>{requirements.items.slice(0, 3).map((item) => <li key={item}><Check size={15} />{item}</li>)}</ul> : null}</section>
      {procedure?.steps?.length ? <GuidedProcedure block={procedure} steps={steps} onToggle={updateStep} media={media} openMedia={setMediaOpen} sources={lesson.sources} /> : null}
      <section className={styles.objectivePanel}><small>YOUR FINISH LINE</small><ul>{lesson.objectives.map((item) => <li key={item}><Target size={17} />{item}</li>)}</ul></section>
      <div className={styles.supportDivider}><Sparkles /><span>Learn, troubleshoot, and verify</span></div>
      {supportingBlocks.map((block, index) => <ContentBlock key={block.id} block={block} number={index + 1} steps={steps} setSteps={setSteps} media={media} openMedia={setMediaOpen} sources={lesson.sources} />)}
      <section className={styles.labConfirmation}><FlaskConical /><div><small>PRACTICAL VERIFICATION</small><h2>Confirm the lab result</h2><p>Only confirm after the result is visible in Workbench and you have recorded any warnings or deviations in your notes.</p><label><input type="checkbox" checked={lab} onChange={(event) => setLab(event.target.checked)} />I completed the practical lab and verified its result.</label></div></section>
      <section className={styles.knowledge}><small>KNOWLEDGE CHECK</small><h2>{lesson.quiz.prompt}</h2>{lesson.quiz.type === "MULTIPLE_CHOICE" && lesson.quiz.options.length ? <div className={styles.options}>{lesson.quiz.options.map((option) => <label key={option}><input type="radio" name="knowledge" checked={answer === option} onChange={() => setAnswer(option)} />{option}</label>)}</div> : <textarea value={Array.isArray(answer) ? answer.join("\n") : answer} onChange={(event) => setAnswer(event.target.value)} placeholder={lesson.quiz.type === "ORDERING" ? "Place each item on its own line in the correct order." : "Answer using the procedure and source evidence."} />}</section>
      <section className={styles.reflection}><small>DEVELOPMENT REFLECTION</small><h2>{lesson.reflectionPrompt}</h2><textarea value={reflection} onChange={(event) => setReflection(event.target.value)} placeholder="Record the decision, evidence, difficulty, and next action…" /></section>
      <section className={styles.finish}><button onClick={() => void save()} disabled={saving}><Save size={17} /> {saving ? "Saving…" : "Save for later"}</button><button className={styles.primaryAction} onClick={() => void save("COMPLETE")} disabled={saving}>Verify and complete Day {lesson.dayNumber} <ArrowRight size={17} /></button>{message && <p role="status">{message}</p>}</section>
    </motion.article>
    <aside className={styles.contextPanel}><section><small>YOUR STUDIO NOTES</small><h2>Development record</h2><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Record paths, settings, warnings, tests, and decisions…" /><button onClick={() => void save()} disabled={saving}><Save size={15} /> Save notes</button></section><section><small>LESSON SOURCES</small><h2>Technical references</h2>{lesson.sources.map((source) => <a key={`${source.id}-${source.sectionAnchor}`} href={`${source.url}${source.sectionAnchor ? `#${source.sectionAnchor}` : ""}`} target="_blank" rel="noreferrer"><b>{source.title}</b><span>Revision {source.revisionId || "pending"} · {source.sectionAnchor || "article"}</span><ExternalLink size={15} /></a>)}</section><section><small>HELP PATH</small><h2>Before messaging faculty</h2><ol><li>Capture the exact console message.</li><li>Note the step where the result changed.</li><li>Compare names and paths to the cited source.</li></ol><Link href="/university?view=messages">Message course faculty <ArrowRight size={15} /></Link></section></aside>
    <footer className={styles.lessonFooter}>{previous ? <Link href={`/university/courses/${course.id}/lessons/${previous.dayNumber}`}><ArrowLeft /> Day {previous.dayNumber}</Link> : <span /> }<b>{lesson.dayNumber} / {course.days.length}</b>{next ? <Link href={`/university/courses/${course.id}/lessons/${next.dayNumber}`}>Day {next.dayNumber} <ArrowRight /></Link> : <Link href={`/university/courses/${course.id}`}>Course overview <ArrowRight /></Link>}</footer>
    <AnimatePresence>{mediaOpen && <motion.div className={styles.mediaDialog} role="dialog" aria-modal="true" aria-label={mediaOpen.altText} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setMediaOpen(null); }}><figure><button onClick={() => setMediaOpen(null)} aria-label="Close image"><X /></button><Image unoptimized src={mediaOpen.url} alt={mediaOpen.altText} width={mediaOpen.width || 1200} height={mediaOpen.height || 800} /><figcaption><b>{mediaOpen.caption || mediaOpen.altText}</b><span>{mediaOpen.sourceSection}</span>{mediaOpen.filePageUrl && <a href={mediaOpen.filePageUrl} target="_blank" rel="noreferrer">View attributed Wiki file page <ExternalLink size={14} /></a>}</figcaption></figure></motion.div>}</AnimatePresence>
  </div>;
}

function GuidedProcedure({ block, steps, onToggle, media, openMedia, sources }: { block: StudioBlock; steps: Record<string, boolean>; onToggle: (stepId: string, checked: boolean) => void; media: Map<string, Media>; openMedia: (media: Media) => void; sources: Source[] }) {
  const actions = block.steps || [];
  const incompleteIndex = actions.findIndex((step) => !steps[step.id]);
  const firstIncomplete = incompleteIndex >= 0 ? incompleteIndex : Math.max(0, actions.length - 1);
  const [activeIndex, setActiveIndex] = useState(firstIncomplete);
  const active = actions[Math.min(activeIndex, Math.max(0, actions.length - 1))];
  const completed = actions.filter((step) => steps[step.id]).length;
  if (!active) return null;
  const visuals = (active.mediaIds || []).map((id) => media.get(id)).filter(Boolean) as Media[];
  const source = sources.find((item) => item.id === active.sourceRef.sourceId) || sources[0];
  const markAndContinue = () => {
    const nextComplete = !steps[active.id];
    onToggle(active.id, nextComplete);
    if (nextComplete && activeIndex < actions.length - 1) setActiveIndex(activeIndex + 1);
  };
  return <section className={styles.guide} aria-labelledby="guided-actions-title">
    <header><div><small>LIVE WORKBENCH WALKTHROUGH</small><h2 id="guided-actions-title">Do this now</h2></div><div className={styles.guideProgress}><b>{completed}/{actions.length}</b><span>actions complete</span></div></header>
    <nav className={styles.stepRail} aria-label="Lesson actions">{actions.map((step, index) => <button key={step.id} className={index === activeIndex ? styles.activeStep : ""} data-complete={Boolean(steps[step.id])} onClick={() => setActiveIndex(index)} aria-current={index === activeIndex ? "step" : undefined}><span>{steps[step.id] ? <Check /> : index + 1}</span><b>Action {index + 1}</b></button>)}</nav>
    <AnimatePresence mode="wait"><motion.div className={styles.activeStepCard} key={active.id} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .22 }}>
      <div className={styles.actionHeading}><span>{String(activeIndex + 1).padStart(2, "0")}</span><div><small>IN WORKBENCH</small><h3>{active.instruction}</h3></div></div>
      <div className={styles.actionEvidence}>
        {active.expectedResult && <article><Eye /><div><small>LOOK FOR THIS</small><p>{active.expectedResult}</p></div></article>}
        {active.why && <article><Lightbulb /><div><small>WHY IT MATTERS</small><p>{active.why}</p></div></article>}
      </div>
      {visuals.map((item) => <MediaFigure key={item.id} item={item} open={() => openMedia(item)} />)}
      <div className={styles.actionFooter}>
        {source ? <a href={`${source.url}${active.sourceRef.sectionAnchor ? `#${active.sourceRef.sectionAnchor}` : ""}`} target="_blank" rel="noreferrer">Check the official source <ExternalLink size={14} /></a> : <span />}
        <div><button onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))} disabled={activeIndex === 0}><ArrowLeft /> Back</button><button className={styles.completeAction} onClick={markAndContinue}>{steps[active.id] ? "Mark incomplete" : activeIndex === actions.length - 1 ? "Complete final action" : "Done — next action"} {steps[active.id] ? null : <ArrowRight />}</button></div>
      </div>
    </motion.div></AnimatePresence>
  </section>;
}

function ContentBlock({ block, number, steps, setSteps, media, openMedia, sources }: { block: StudioBlock; number: number; steps: Record<string, boolean>; setSteps: React.Dispatch<React.SetStateAction<Record<string, boolean>>>; media: Map<string, Media>; openMedia: (media: Media) => void; sources: Source[] }) {
  const icons: Record<string, React.ReactNode> = { CONCEPT: <BookOpen />, REQUIREMENTS: <Focus />, PROCEDURE: <Wrench />, WARNING: <CircleAlert />, TROUBLESHOOTING: <CircleAlert />, LAB: <FlaskConical />, VERIFICATION: <Check /> };
  const blockMedia = (block.mediaIds || []).map((id) => media.get(id)).filter(Boolean) as Media[];
  return <section className={`${styles.contentBlock} ${styles[`type${block.type}`] || ""}`}><header><span>{String(number).padStart(2, "0")}</span><i>{icons[block.type] || <BookOpen />}</i><div><small>{block.type.replaceAll("_", " ")}</small><h2>{block.title}</h2></div></header>{block.body && <p>{block.body}</p>}{block.items && <ul>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>}{block.steps && <ol className={styles.procedure}>{block.steps.map((step, index) => { const visuals = (step.mediaIds || []).map((id) => media.get(id)).filter(Boolean) as Media[]; const source = sources.find((item) => item.id === step.sourceRef.sourceId); return <li key={step.id} data-complete={Boolean(steps[step.id])}><label><input type="checkbox" checked={Boolean(steps[step.id])} onChange={(event) => setSteps((current) => ({ ...current, [step.id]: event.target.checked }))} /><span>{index + 1}</span><b>{step.instruction}</b></label>{step.expectedResult && <div className={styles.expected}><small>EXPECTED RESULT</small><p>{step.expectedResult}</p></div>}{step.why && <div className={styles.why}><small>WHY THIS MATTERS</small><p>{step.why}</p></div>}{visuals.map((item) => <MediaFigure key={item.id} item={item} open={() => openMedia(item)} />)}{source && <a className={styles.stepSource} href={`${source.url}#${step.sourceRef.sectionAnchor}`} target="_blank" rel="noreferrer">Source: {source.title} · {step.sourceRef.sectionAnchor} <ExternalLink size={13} /></a>}</li>; })}</ol>}{blockMedia.map((item) => <MediaFigure key={item.id} item={item} open={() => openMedia(item)} />)}</section>;
}

function MediaFigure({ item, open }: { item: Media; open: () => void }) { return <figure className={styles.mediaFigure}><button onClick={open} aria-label={`Enlarge ${item.altText}`}><Image unoptimized src={item.url} alt={item.altText} width={item.width || 1100} height={item.height || 700} /><span><Maximize2 size={16} /> Enlarge example</span></button><figcaption><b>{item.caption || item.altText}</b><span>Bohemia Interactive Community Wiki · {item.sourceSection || "Technical example"}</span></figcaption></figure>; }
function StudioLoading() { return <main className={styles.loading}><Image src="/enscript-university-lockup.png" alt="Enscript University" width={1983} height={793} priority /><i /><p>Preparing your Guided Course Studio…</p></main>; }
function StudioFailure({ message }: { message: string }) { return <main className={styles.failure}><Image src="/enscript-university-lockup.png" alt="Enscript University" width={1983} height={793} /><small>COURSE STUDIO</small><h1>This studio could not open.</h1><p>{message}</p><Link href="/university?view=learning">Return to My Learning</Link></main>; }
