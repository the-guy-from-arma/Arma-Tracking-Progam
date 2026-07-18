"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { UniversityView } from "./UniversityPortal";
import styles from "./UniversityLearning.module.css";
import { StudentCenter } from "./StudentCenter";
import { StudentProfile } from "./StudentProfile";
import { facultyForAcademy } from "@/lib/ai-faculty";

type Enrollment = { id: string; status: string; progress: number };
type Course = {
  id: string;
  code: string;
  title: string;
  summary: string;
  deliverable: string;
  studio: string;
  level: string;
  academy: string;
  estimatedDays: number;
  workloadHours: number;
  learningCredits: number;
  serviceValueCents: number;
  outcomes: string[];
  completedDays: number;
  enrollments: Enrollment[];
  prerequisites: {
    prerequisite: { id: string; code: string; title: string };
  }[];
  sources: { syncStatus: string; statusWarnings: string[] }[];
  _count: { enrollments: number; days: number };
};
type Curriculum = {
  courses: Course[];
  academies: string[];
  enrolled: Course[];
  nextCourse: Course | null;
  grantBalanceCents: number;
  coverage: { mapped: number; total: number };
};
type CourseDay = {
  id: string;
  dayNumber: number;
  title: string;
  objectives: string[];
  instructionalText: string;
  sourceSection: string;
  workbenchSteps: string[];
  practicalLab: string;
  completionChecklist: string[];
  knowledgeQuestion: string;
  reflectionPrompt: string;
  progress: { completed: boolean; reflection: string | null }[];
};
type CourseDetail = Omit<Course, "sources"> & {
  days: CourseDay[];
  sources: {
    wikiTitle: string;
    url: string;
    sourceExcerpt: string;
    syncStatus: string;
    statusWarnings: string[];
    revisionId: string | null;
  }[];
};
type Submission = {
  id: string;
  title: string;
  status: string;
  feedback: string | null;
  submittedAt?: string;
  course: { code: string; title: string };
  aiDecisions?: {
    totalScore: number;
    confidence: number;
    passed: boolean;
    structuredResult: { remediationSteps?: string[] };
  }[];
};
type AcademyData = {
  submissions: Submission[];
  certificates: {
    id: string;
    credentialCode: string;
    title: string;
    issuer: string;
    issuedAt: string;
    learningCredits: number;
  }[];
  learningCredits: number;
};
type Program = {
  id: string;
  code: string;
  title: string;
  summary: string;
  level: string;
  academy: string;
  creditsRequired: number;
  durationDays: number;
  estimatedValueCents: number;
  credentialTitle: string;
  audience: string;
  culminatingExperience: string;
  learningOutcomes: string[];
  sponsoredBy: string;
  requirements: {
    id: string;
    type: string;
    sequence: number;
    termNumber: number;
    course: {
      id: string;
      code: string;
      title: string;
      summary: string;
      academy: string;
      learningCredits: number;
      serviceValueCents: number;
      estimatedDays: number;
      workloadHours: number;
    };
  }[];
  enrollments: Enrollment[];
  applications: { id: string; status: string }[];
};
type ProgramsData = { programs: Program[]; degreeWordingEnabled: boolean };
type FundingData = {
  balanceCents: number;
  studentResponsibilityCents: number;
  ledger: {
    id: string;
    type: string;
    amountCents: number;
    description: string;
    createdAt: string;
  }[];
  terms: {
    id: string;
    startsAt: string;
    endsAt: string;
    status: string;
    scheduledValueCents: number;
    reserveCents: number;
    awardedCents: number;
    program: { title: string; code: string } | null;
    plannedCourses: {
      course: { code: string; title: string; serviceValueCents: number };
    }[];
  }[];
};
type NotificationData = {
  notifications: {
    id: string;
    type: string;
    title: string;
    body: string;
    actionUrl: string | null;
    readAt: string | null;
    createdAt: string;
  }[];
  unread: number;
};
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
const percent = (course: Course) =>
  Math.round((course.completedDays / Math.max(1, course._count.days)) * 100);

export function UniversityLearning({
  view,
  userName,
  onNavigate,
}: {
  view: UniversityView;
  userName: string;
  onNavigate: (view: UniversityView) => void;
}) {
  const [data, setData] = useState<Curriculum | null>(null);
  const [records, setRecords] = useState<AcademyData | null>(null);
  const [programs, setPrograms] = useState<ProgramsData | null>(null);
  const [funding, setFunding] = useState<FundingData | null>(null);
  const [notifications, setNotifications] = useState<NotificationData | null>(
    null,
  );
  const [selected, setSelected] = useState<CourseDetail | null>(null);
  const [previewCourse, setPreviewCourse] = useState<CourseDetail | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [search, setSearch] = useState("");
  const [academy, setAcademy] = useState("ALL");
  const [level, setLevel] = useState("ALL");
  const [applying, setApplying] = useState<Program | null>(null);
  const [error, setError] = useState("");
  const [renderedAt] = useState(() => Date.now());

  const load = useCallback(async () => {
    const responses = await Promise.all([
      fetch("/api/curriculum"),
      fetch("/api/academy"),
      fetch("/api/university/programs"),
      fetch("/api/university/funding"),
      fetch("/api/university/notifications"),
    ]);
    const payloads = await Promise.all(
      responses.map((response) => response.json()),
    );
    if (!responses[0].ok) {
      setError(payloads[0].error || "Curriculum unavailable.");
      return;
    }
    setData(payloads[0]);
    if (responses[1].ok) setRecords(payloads[1]);
    if (responses[2].ok) setPrograms(payloads[2]);
    if (responses[3].ok) setFunding(payloads[3]);
    if (responses[4].ok) setNotifications(payloads[4]);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function openCourse(id: string) {
    const response = await fetch(`/api/curriculum/${id}`);
    const result = await response.json();
    if (response.ok) setSelected(result.course);
    else setError(result.error);
  }
  async function preview(id: string) {
    const response = await fetch(`/api/curriculum/${id}`);
    const result = await response.json();
    if (response.ok) setPreviewCourse(result.course);
    else setError(result.error);
  }
  const filtered = useMemo(
    () =>
      data?.courses.filter(
        (course) =>
          (academy === "ALL" || course.academy === academy) &&
          (level === "ALL" || course.level === level) &&
          `${course.code} ${course.title} ${course.summary}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ) || [],
    [data, academy, level, search],
  );
  const filteredPrograms = useMemo(
    () =>
      programs?.programs.filter(
        (program) =>
          (academy === "ALL" || program.academy === academy) &&
          (level === "ALL" || program.level === level) &&
          `${program.code} ${program.title} ${program.summary}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ) || [],
    [programs, academy, level, search],
  );
  if (!data)
    return (
      <div className={styles.loading}>
        <div className={styles.loadingOrbit}>
          <i />
          <i />
          <b>EU</b>
        </div>
        <span>{error || "OPENING YOUR CAMPUS"}</span>
      </div>
    );
  if (selected)
    return (
      <CoursePlayer
        course={selected}
        close={() => {
          setSelected(null);
          void load();
        }}
        refresh={() => openCourse(selected.id)}
      />
    );

  if (view === "student-center") return <StudentCenter />;
  if (view === "profile") return <StudentProfile />;

  if (view === "dashboard") {
    const next = data.nextCourse;
    const activeTerm = funding?.terms.find((term) => term.status === "ACTIVE");
    const totalDays = data.enrolled.reduce(
      (sum, course) => sum + course._count.days,
      0,
    );
    const doneDays = data.enrolled.reduce(
      (sum, course) => sum + course.completedDays,
      0,
    );
    return (
      <section className={styles.learning}>
        <motion.header
          className={styles.lmsBanner}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <p>ENFUSION UNIVERSITY · STUDENT CAMPUS</p>
            <h1>Welcome back, {userName.split(" ")[0]}</h1>
            <span>
              Continue your technical coursework, review new feedback, and stay
              ahead of your next academic activity.
            </span>
            <div>
              {next ? (
                <button onClick={() => openCourse(next.id)}>
                  CONTINUE {next.code} →
                </button>
              ) : (
                <button onClick={() => onNavigate("catalog")}>
                  DISCOVER YOUR FIRST COURSE →
                </button>
              )}
              <button onClick={() => onNavigate("student-center")}>
                OPEN STUDENT CENTER
              </button>
            </div>
          </div>
          <aside>
            <small>OVERALL COURSE PROGRESS</small>
            <ProgressRing
              value={totalDays ? Math.round((doneDays / totalDays) * 100) : 0}
            />
            <b>
              {doneDays} of {totalDays} learning days complete
            </b>
          </aside>
        </motion.header>
        <div className={styles.lmsHomeGrid}>
          <main>
            <section className={styles.lmsPanel}>
              <SectionHead
                eyebrow="CURRENT TERM"
                title="My courses"
                action={`${data.enrolled.length} ACTIVE`}
              />
              <div className={styles.lmsCourseGrid}>
                {data.enrolled.slice(0, 6).map((course, index) => (
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    key={course.id}
                    onClick={() => openCourse(course.id)}
                  >
                    <div
                      className={styles.courseCover}
                      data-academy={course.academy}
                    >
                      <span>{course.academy}</span>
                      <b>{course.code}</b>
                    </div>
                    <div>
                      <h3>{course.title}</h3>
                      <p>
                        Next: Day{" "}
                        {Math.min(course._count.days, course.completedDays + 1)}{" "}
                        of {course._count.days}
                      </p>
                      <i>
                        <span style={{ width: `${percent(course)}%` }} />
                      </i>
                      <footer>
                        <b>{percent(course)}% complete</b>
                        <span>OPEN COURSE →</span>
                      </footer>
                    </div>
                  </motion.button>
                ))}
                {!data.enrolled.length && (
                  <div className={styles.lmsEmpty}>
                    <b>No active courses yet</b>
                    <p>
                      Use Discover to compare all 192 courses or ask Orbit for a
                      recommended pathway.
                    </p>
                    <button onClick={() => onNavigate("catalog")}>
                      BROWSE COURSE CATALOG
                    </button>
                  </div>
                )}
              </div>
            </section>
            <section className={styles.quickServices}>
              <button onClick={() => onNavigate("student-center")}>
                <i>SC</i>
                <span>
                  <b>Student Center</b>
                  <small>Applications, advising and enrollment</small>
                </span>
              </button>
              <button onClick={() => onNavigate("funding")}>
                <i>$</i>
                <span>
                  <b>Funding Center</b>
                  <small>
                    {money(funding?.balanceCents ?? data.grantBalanceCents)}{" "}
                    available
                  </small>
                </span>
              </button>
              <button onClick={() => onNavigate("submissions")}>
                <i>✓</i>
                <span>
                  <b>Assignments & Grades</b>
                  <small>
                    {records?.submissions.length || 0} assessment records
                  </small>
                </span>
              </button>
              <button onClick={() => onNavigate("credentials")}>
                <i>★</i>
                <span>
                  <b>Credentials</b>
                  <small>
                    {records?.certificates.length || 0} completion records
                  </small>
                </span>
              </button>
            </section>
          </main>
          <aside className={styles.lmsSidebar}>
            <section className={styles.lmsPanel}>
              <SectionHead
                eyebrow="CAMPUS NEWS"
                title="Announcements"
                action={`${notifications?.unread || 0} NEW`}
              />
              <div className={styles.announcementList}>
                {notifications?.notifications.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onNavigate("notifications")}
                  >
                    <i className={item.readAt ? "" : styles.unread} />
                    <span>
                      <b>{item.title}</b>
                      <small>
                        {new Date(item.createdAt).toLocaleDateString()} ·{" "}
                        {item.type}
                      </small>
                      <p>{item.body}</p>
                    </span>
                  </button>
                ))}
                {!notifications?.notifications.length && (
                  <p className={styles.noNews}>
                    There are no new campus announcements.
                  </p>
                )}
              </div>
              <button
                className={styles.panelLink}
                onClick={() => onNavigate("notifications")}
              >
                VIEW ALL ANNOUNCEMENTS →
              </button>
            </section>
            <section className={styles.lmsPanel}>
              <SectionHead
                eyebrow="UPCOMING"
                title="Important dates"
                action="120-DAY TERM"
              />
              <div className={styles.eventList}>
                <article>
                  <time>
                    {activeTerm ? new Date(activeTerm.endsAt).getDate() : "—"}
                    <small>
                      {activeTerm
                        ? new Date(activeTerm.endsAt)
                            .toLocaleDateString("en-US", { month: "short" })
                            .toUpperCase()
                        : "TERM"}
                    </small>
                  </time>
                  <div>
                    <b>Sponsored funding renewal</b>
                    <span>
                      {activeTerm
                        ? new Date(activeTerm.endsAt).toLocaleDateString()
                        : "Activates with your program term"}
                    </span>
                  </div>
                </article>
                {next && (
                  <article>
                    <time>
                      {Math.min(next._count.days, next.completedDays + 1)}
                      <small>DAY</small>
                    </time>
                    <div>
                      <b>{next.code} next activity</b>
                      <span>{next.title}</span>
                    </div>
                  </article>
                )}
              </div>
            </section>
            <section className={styles.studentSnapshot}>
              <small>ACADEMIC SNAPSHOT</small>
              <div>
                <span>
                  <b>{records?.learningCredits || 0}</b> CREDITS
                </span>
                <span>
                  <b>{doneDays}</b> DAYS
                </span>
                <span>
                  <b>{data.coverage.mapped}</b> SOURCES
                </span>
              </div>
              <button onClick={() => onNavigate("profile")}>
                VIEW ACADEMIC PROFILE →
              </button>
            </section>
            <section className={styles.facultyPresence}>
              <small>AI FACULTY COMMONS · AVAILABLE NOW</small>
              {["Workbench Foundations", "Enforce Script", "Terrain and World Building"].map((academy) => {
                const faculty = facultyForAcademy(academy);
                return <article key={faculty.id}><i>{faculty.initials}</i><span><b>{faculty.name}</b><p>{faculty.specialty}</p></span><em>ONLINE</em></article>;
              })}
            </section>
          </aside>
        </div>
      </section>
    );
  }

  if (view === "catalog")
    return (
      <section className={styles.learning}>
        <PageHead
          eyebrow="16 ACADEMIES / SOURCE-GROUNDED"
          title="Course constellation"
          copy="Open any course to read its outcomes, prerequisites, syllabus, assessed artifact, technical sources, and sponsored value before deciding."
          count={`${filtered.length} / ${data.courses.length}`}
        />
        <Filters
          academies={data.academies}
          academy={academy}
          setAcademy={setAcademy}
          level={level}
          setLevel={setLevel}
          search={search}
          setSearch={setSearch}
          levels={["FOUNDATION", "INTERMEDIATE", "ADVANCED", "CAPSTONE"]}
        />
        <div className={styles.courseGrid}>
          {filtered.map((course, index) => (
            <motion.article
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 12) * 0.025 }}
              className={styles.courseCard}
              key={course.id}
            >
              <header>
                <span>{course.code}</span>
                <i>{course.level}</i>
              </header>
              <FacultyBadge academy={course.academy} />
              <div className={styles.courseOrb}>
                <b>{course.estimatedDays}</b>
                <small>DAYS</small>
              </div>
              <button
                className={styles.titleButton}
                onClick={() => preview(course.id)}
              >
                <h2>{course.title}</h2>
                <span>READ COURSE OVERVIEW →</span>
              </button>
              <p>{course.summary}</p>
              <div className={styles.courseFacts}>
                <span>{course.workloadHours} HOURS</span>
                <span>{course.learningCredits} CREDITS</span>
                <span>{course.academy}</span>
              </div>
              <div className={styles.valueStatement}>
                <small>SPONSORED EDUCATION VALUE</small>
                <b>{money(course.serviceValueCents)}</b>
                <span>Grant applied at enrollment · You owe $0.00</span>
              </div>
              {course.enrollments.length ? (
                <button
                  className={styles.primary}
                  onClick={() => openCourse(course.id)}
                >
                  OPEN COURSE →
                </button>
              ) : (
                <button onClick={() => preview(course.id)}>
                  EXPLORE BEFORE ENROLLING →
                </button>
              )}
            </motion.article>
          ))}
        </div>
        <AnimatePresence>
          {previewCourse && (
            <CoursePreview
              course={previewCourse}
              close={() => setPreviewCourse(null)}
              open={() => {
                setPreviewCourse(null);
                void openCourse(previewCourse.id);
              }}
              advisor={() => {
                setPreviewCourse(null);
                onNavigate("student-center");
              }}
            />
          )}
        </AnimatePresence>
      </section>
    );

  if (view === "learning")
    return (
      <section className={styles.learning}>
        <PageHead
          eyebrow="YOUR ACTIVE ORBIT"
          title="Learning studio"
          copy="Resume lessons, see the next required activity, and move each technical build toward assessment."
          count={`${data.enrolled.length} ACTIVE`}
        />
        <div className={styles.learningGrid}>
          {data.enrolled.map((course) => (
            <article key={course.id} className={styles.learningCard}>
              <div className={styles.learningVisual}>
                <ProgressRing value={percent(course)} />
                <span>{course.code}</span>
              </div>
              <div>
                <small>{course.academy}</small>
                <h2>{course.title}</h2>
                <p>
                  Next required activity: Day{" "}
                  {Math.min(course._count.days, course.completedDays + 1)} ·{" "}
                  {course._count.days - course.completedDays} learning days
                  remain
                </p>
                <div className={styles.track}>
                  <i style={{ width: `${percent(course)}%` }} />
                </div>
                <footer>
                  <span>{percent(course)}% COMPLETE</span>
                  <button onClick={() => openCourse(course.id)}>
                    RESUME →
                  </button>
                </footer>
              </div>
            </article>
          ))}
          {!data.enrolled.length && (
            <Empty text="Enroll in a course to build your active learning studio." />
          )}
        </div>
      </section>
    );

  if (view === "programs")
    return (
      <section className={styles.learning}>
        <PageHead
          eyebrow="144 DISTINCT ACADEMIC PATHWAYS"
          title="Programs of study"
          copy="Every certificate, associate pathway, and bachelor-level program now has a different purpose, audience, curriculum map, and culminating experience."
          count={`${filteredPrograms.length} / ${programs?.programs.length || 0}`}
        />
        <Filters
          academies={data.academies}
          academy={academy}
          setAcademy={setAcademy}
          level={level}
          setLevel={setLevel}
          search={search}
          setSearch={setSearch}
          levels={["SHORT", "ASSOCIATE", "BACHELOR"]}
        />
        <div className={styles.programGrid}>
          {filteredPrograms.map((program) => (
            <article className={styles.programCard} key={program.id}>
              <header>
                <span>
                  {program.level === "SHORT"
                    ? "SHORT CREDENTIAL"
                    : program.level === "ASSOCIATE"
                      ? "ASSOCIATE PROGRAM"
                      : "BACHELOR'S PROGRAM"}
                </span>
                <i>{program.code}</i>
              </header>
              <FacultyBadge academy={program.academy} />
              <small>{program.academy}</small>
              <button
                className={styles.titleButton}
                onClick={() => setSelectedProgram(program)}
              >
                <h2>{program.title}</h2>
                <span>EXPLORE THE FULL PATHWAY →</span>
              </button>
              <p>{program.summary}</p>
              <div className={styles.programStats}>
                <span>
                  <b>{program.requirements.length}</b> COURSES
                </span>
                <span>
                  <b>{program.creditsRequired}</b> CREDITS
                </span>
                <span>
                  <b>{Math.ceil(program.durationDays / 120)}</b> TERMS
                </span>
              </div>
              <div className={styles.programValue}>
                <span>PROGRAM SPONSORED VALUE</span>
                <b>{money(program.estimatedValueCents)}</b>
              </div>
              <button onClick={() => setSelectedProgram(program)}>
                {program.enrollments.length
                  ? "VIEW ACTIVE PROGRAM →"
                  : "READ PROGRAM DETAILS →"}
              </button>
            </article>
          ))}
        </div>
        <AnimatePresence>
          {selectedProgram && (
            <ProgramDetail
              program={selectedProgram}
              close={() => setSelectedProgram(null)}
              apply={() => {
                setSelectedProgram(null);
                setApplying(selectedProgram);
              }}
            />
          )}{" "}
          {applying && (
            <ProgramApplication
              program={applying}
              close={() => setApplying(null)}
              submitted={async () => {
                setApplying(null);
                await load();
              }}
            />
          )}
        </AnimatePresence>
      </section>
    );

  if (view === "funding")
    return <FundingCenter data={funding} renderedAt={renderedAt} />;
  if (view === "notifications")
    return <Notifications data={notifications} refresh={load} />;
  if (view === "submissions")
    return (
      <section className={styles.learning}>
        <PageHead
          eyebrow="INTELLIGENT ASSESSMENT"
          title="Assessment record"
          copy="Gemini evaluates routine work against your rubric and the mapped Bohemia technical sources; exceptions remain protected by faculty review."
          count={`${records?.submissions.length || 0} RECORDS`}
        />
        <div className={styles.recordGrid}>
          {records?.submissions.map((submission) => {
            const grade = submission.aiDecisions?.[0];
            return (
              <article className={styles.assessmentCard} key={submission.id}>
                <header>
                  <Status value={submission.status} />
                  <span>{submission.course.code}</span>
                </header>
                <h2>{submission.title}</h2>
                <p>{submission.course.title}</p>
                {grade && (
                  <div className={styles.grade}>
                    <ProgressRing value={grade.totalScore} />
                    <div>
                      <small>AI ASSESSMENT</small>
                      <b>{grade.totalScore}/100</b>
                      <span>
                        {Math.round(grade.confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>
                )}
                {submission.feedback && (
                  <blockquote>{submission.feedback}</blockquote>
                )}
                {["REVISION_REQUIRED", "DECLINED", "AI_EXCEPTION"].includes(
                  submission.status,
                ) && <AppealForm submissionId={submission.id} />}
              </article>
            );
          })}
          {!records?.submissions.length && (
            <Empty text="Final course artifacts and intelligent assessment feedback will appear here." />
          )}
        </div>
      </section>
    );
  return (
    <section className={styles.learning}>
      <PageHead
        eyebrow="VERIFIABLE COMPLETION"
        title="Credentials"
        copy="Every completed course builds a permanent learning record with a public verification code."
        count={`${records?.certificates.length || 0} EARNED`}
      />
      <div className={styles.credentialGrid}>
        {records?.certificates.map((certificate) => (
          <article className={styles.credentialCard} key={certificate.id}>
            <div className={styles.seal}>EU</div>
            <small>{new Date(certificate.issuedAt).toLocaleDateString()}</small>
            <h2>{certificate.title}</h2>
            <p>{certificate.issuer}</p>
            <footer>
              <span>{certificate.learningCredits} LEARNING CREDITS</span>
              <Link href={`/credentials/${certificate.credentialCode}`}>
                VERIFY ↗
              </Link>
            </footer>
          </article>
        ))}
        {!records?.certificates.length && (
          <Empty text="Approved assessment work will issue verifiable credentials here." />
        )}
      </div>
    </section>
  );
}

function SectionHead({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action: string;
}) {
  return (
    <header className={styles.sectionHead}>
      <div>
        <small>{eyebrow}</small>
        <h2>{title}</h2>
      </div>
      <span>{action}</span>
    </header>
  );
}
function PageHead({
  eyebrow,
  title,
  copy,
  count,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  count: string;
}) {
  return (
    <header className={styles.pageHead}>
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{copy}</span>
      </div>
      <b>{count}</b>
    </header>
  );
}
function ProgressRing({ value }: { value: number }) {
  return (
    <span
      className={styles.progressRing}
      style={
        {
          "--value": `${Math.max(0, Math.min(100, value))}%`,
        } as React.CSSProperties
      }
    >
      <b>{value}%</b>
    </span>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className={styles.empty}>
      <i>○</i>
      <p>{text}</p>
    </div>
  );
}
function FacultyBadge({ academy }: { academy: string }) {
  const faculty = facultyForAcademy(academy);
  return (
    <div className={styles.facultyBadge}>
      <i>{faculty.initials}</i>
      <span>
        <small>AI FACULTY</small>
        <b>{faculty.name}</b>
        <em>{faculty.voice}</em>
      </span>
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <b className={`${styles.status} ${styles[value.toLowerCase()] || ""}`}>
      {value.replaceAll("_", " ")}
    </b>
  );
}

function Filters({
  academies,
  academy,
  setAcademy,
  level,
  setLevel,
  search,
  setSearch,
  levels,
}: {
  academies: string[];
  academy: string;
  setAcademy: (value: string) => void;
  level: string;
  setLevel: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
  levels: string[];
}) {
  return (
    <div className={styles.filters}>
      <label>
        <span>SEARCH</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Course, program, subject, or code"
        />
      </label>
      <label>
        <span>ACADEMY</span>
        <select
          value={academy}
          onChange={(event) => setAcademy(event.target.value)}
        >
          <option value="ALL">All 16 academies</option>
          {academies.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      <label>
        <span>LEVEL</span>
        <select
          value={level}
          onChange={(event) => setLevel(event.target.value)}
        >
          <option value="ALL">All levels</option>
          {levels.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function FundingCenter({
  data,
  renderedAt,
}: {
  data: FundingData | null;
  renderedAt: number;
}) {
  if (!data)
    return (
      <div className={styles.loading}>PREPARING YOUR FUNDING STATEMENT</div>
    );
  const active =
    data.terms.find((term) => term.status === "ACTIVE") || data.terms[0];
  const days = active
    ? Math.max(0, Math.ceil((+new Date(active.endsAt) - renderedAt) / 86400000))
    : 0;
  return (
    <section className={styles.learning}>
      <PageHead
        eyebrow="SPONSORED LEARNING ACCOUNT"
        title="Funding center"
        copy="A complete record of internal, noncash educational sponsorship applied to your Enfusion University study."
        count="YOU OWE $0.00"
      />
      <div className={styles.fundingHero}>
        <div>
          <small>AVAILABLE SPONSORED BALANCE</small>
          <h2>{money(data.balanceCents)}</h2>
          <p>Thunder Buddies Studios continuing-study grant</p>
          <span>
            Internal sponsored-learning credits · not cashable · no student debt
          </span>
        </div>
        <div className={styles.termOrbit}>
          <ProgressRing
            value={
              active
                ? Math.min(
                    100,
                    Math.round(
                      (data.balanceCents / Math.max(1, active.awardedCents)) *
                        100,
                    ),
                  )
                : 100
            }
          />
          <div>
            <small>CURRENT TERM</small>
            <b>{days} DAYS</b>
            <span>UNTIL AUTOMATIC RENEWAL</span>
          </div>
        </div>
        <aside>
          <span>STUDENT RESPONSIBILITY</span>
          <b>$0.00</b>
          <small>NO PAYMENT DUE</small>
        </aside>
      </div>
      {active && (
        <div className={styles.fundingGrid}>
          <section>
            <SectionHead
              eyebrow="120-DAY PLAN"
              title="Current term"
              action={active.status}
            />
            <div className={styles.termDates}>
              <span>
                <small>TERM START</small>
                <b>{new Date(active.startsAt).toLocaleDateString()}</b>
              </span>
              <i />
              <span>
                <small>AUTO RENEWAL</small>
                <b>{new Date(active.endsAt).toLocaleDateString()}</b>
              </span>
            </div>
            <div className={styles.awardBreakdown}>
              <div>
                <span>Scheduled education</span>
                <b>{money(active.scheduledValueCents)}</b>
              </div>
              <div>
                <span>Learning reserve</span>
                <b>{money(active.reserveCents)}</b>
              </div>
              <div>
                <span>Total term sponsorship</span>
                <b>{money(active.awardedCents)}</b>
              </div>
            </div>
            <h3>PLANNED COURSE ALLOCATIONS</h3>
            {active.plannedCourses.map((item) => (
              <div className={styles.plannedCourse} key={item.course.code}>
                <span>
                  {item.course.code} · {item.course.title}
                </span>
                <b>{money(item.course.serviceValueCents)}</b>
              </div>
            ))}
          </section>
          <section>
            <SectionHead
              eyebrow="ACCOUNT ACTIVITY"
              title="Funding ledger"
              action={`${data.ledger.length} ENTRIES`}
            />
            <div className={styles.ledger}>
              {data.ledger.map((entry) => (
                <article key={entry.id}>
                  <i
                    className={
                      entry.amountCents >= 0 ? styles.credit : styles.debit
                    }
                  >
                    {entry.amountCents >= 0 ? "+" : "−"}
                  </i>
                  <div>
                    <b>{entry.description}</b>
                    <span>
                      {entry.type.replaceAll("_", " ")} ·{" "}
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <strong>
                    {entry.amountCents >= 0 ? "+" : ""}
                    {money(entry.amountCents)}
                  </strong>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function Notifications({
  data,
  refresh,
}: {
  data: NotificationData | null;
  refresh: () => Promise<void>;
}) {
  async function markAll() {
    await fetch("/api/university/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    await refresh();
  }
  return (
    <section className={styles.learning}>
      <PageHead
        eyebrow="CAMPUS SIGNALS"
        title="Notifications"
        copy="Funding renewals, feedback, deadlines, and academic activity in one quiet, actionable stream."
        count={`${data?.unread || 0} UNREAD`}
      />
      <div className={styles.notificationActions}>
        <button onClick={markAll}>MARK ALL AS READ</button>
      </div>
      <div className={styles.notificationList}>
        {data?.notifications.map((item) => (
          <article
            className={!item.readAt ? styles.newNotice : ""}
            key={item.id}
          >
            <i />
            <div>
              <small>
                {item.type} · {new Date(item.createdAt).toLocaleString()}
              </small>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
            </div>
            {item.actionUrl && <a href={item.actionUrl}>OPEN →</a>}
          </article>
        ))}
        {!data?.notifications.length && (
          <Empty text="You are completely caught up." />
        )}
      </div>
    </section>
  );
}

function CoursePreview({
  course,
  close,
  open,
  advisor,
}: {
  course: CourseDetail;
  close: () => void;
  open: () => void;
  advisor: () => void;
}) {
  const active = course.enrollments.some(
    (item) => item.status === "ACTIVE" || item.status === "COMPLETED",
  );
  return (
    <motion.div
      className={styles.detailBack}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <motion.article
        className={styles.courseDetail}
        initial={{ x: 70, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 70, opacity: 0 }}
      >
        <button
          className={styles.detailClose}
          onClick={close}
          aria-label="Close course overview"
        >
          ×
        </button>
        <header>
          <div>
            <small>
              {course.code} / {course.academy}
            </small>
            <h1>{course.title}</h1>
            <p>{course.summary}</p>
          </div>
          <div className={styles.detailOrb}>
            <b>{course.estimatedDays}</b>
            <span>DAY COURSE</span>
            <i />
          </div>
        </header>
        <div className={styles.detailFacts}>
          <span>
            <small>LEVEL</small>
            <b>{course.level}</b>
          </span>
          <span>
            <small>WORKLOAD</small>
            <b>{course.workloadHours} hours</b>
          </span>
          <span>
            <small>LEARNING RECORD</small>
            <b>{course.learningCredits} credits</b>
          </span>
          <span>
            <small>SPONSORED VALUE</small>
            <b>{money(course.serviceValueCents)}</b>
          </span>
        </div>
        <div className={styles.detailBody}>
          <main>
            <section>
              <small>WHAT YOU WILL LEARN</small>
              <h2>Course outcomes</h2>
              <ul>
                {course.outcomes.map((outcome) => (
                  <li key={outcome}>{outcome}</li>
                ))}
              </ul>
            </section>
            <section>
              <small>ASSESSED PRACTICAL WORK</small>
              <h2>Final artifact</h2>
              <p>{course.deliverable}</p>
            </section>
            <section>
              <small>DAY-BY-DAY PREVIEW</small>
              <h2>Syllabus</h2>
              <ol className={styles.syllabus}>
                {course.days.map((day) => (
                  <li key={day.id}>
                    <span>{String(day.dayNumber).padStart(2, "0")}</span>
                    <div>
                      <b>{day.title}</b>
                      <small>{day.objectives[0]}</small>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </main>
          <aside>
            <section>
              <small>BEFORE YOU BEGIN</small>
              <h3>Prerequisites</h3>
              {course.prerequisites.length ? (
                course.prerequisites.map((item) => (
                  <div
                    className={styles.prerequisite}
                    key={item.prerequisite.id}
                  >
                    <span>{item.prerequisite.code}</span>
                    <b>{item.prerequisite.title}</b>
                  </div>
                ))
              ) : (
                <p>
                  No catalog prerequisite. Orbit will still check your readiness
                  and available study time.
                </p>
              )}
            </section>
            <section>
              <small>TECHNICAL AUTHORITY</small>
              <h3>Bohemia Wiki sources</h3>
              {course.sources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <b>{source.wikiTitle}</b>
                  <span>
                    Revision {source.revisionId || "sync pending"} ·{" "}
                    {source.syncStatus}
                  </span>
                </a>
              ))}
            </section>
          </aside>
        </div>
        <footer>
          <div>
            <small>THUNDER BUDDIES STUDIOS × BLACK RIDGE STUDIOS</small>
            <b>Student responsibility remains $0.00</b>
          </div>
          <button onClick={close}>KEEP EXPLORING</button>
          <button className={styles.primary} onClick={active ? open : advisor}>
            {active ? "ENTER COURSE →" : "ASK ORBIT ABOUT THIS COURSE →"}
          </button>
        </footer>
      </motion.article>
    </motion.div>
  );
}

function ProgramDetail({
  program,
  close,
  apply,
}: {
  program: Program;
  close: () => void;
  apply: () => void;
}) {
  const terms = [
    ...new Set(program.requirements.map((item) => item.termNumber)),
  ];
  return (
    <motion.div
      className={styles.detailBack}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <motion.article
        className={`${styles.courseDetail} ${styles.programDetail}`}
        initial={{ x: 70, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 70, opacity: 0 }}
      >
        <button
          className={styles.detailClose}
          onClick={close}
          aria-label="Close program overview"
        >
          ×
        </button>
        <header>
          <div>
            <small>
              {program.code} / {program.academy}
            </small>
            <h1>{program.title}</h1>
            <p>{program.summary}</p>
          </div>
          <div className={styles.detailOrb}>
            <b>{program.requirements.length}</b>
            <span>COURSES</span>
            <i />
          </div>
        </header>
        <div className={styles.detailFacts}>
          <span>
            <small>PATHWAY</small>
            <b>{program.level}</b>
          </span>
          <span>
            <small>PLANNED LENGTH</small>
            <b>{Math.ceil(program.durationDays / 120)} terms</b>
          </span>
          <span>
            <small>LEARNING RECORD</small>
            <b>{program.creditsRequired} credits</b>
          </span>
          <span>
            <small>SPONSORED VALUE</small>
            <b>{money(program.estimatedValueCents)}</b>
          </span>
        </div>
        <div className={styles.detailBody}>
          <main>
            <section>
              <small>DESIGNED FOR</small>
              <h2>Who this pathway serves</h2>
              <p>{program.audience}</p>
            </section>
            <section>
              <small>PROGRAM OUTCOMES</small>
              <h2>What makes this pathway distinct</h2>
              <ul>
                {program.learningOutcomes.map((outcome) => (
                  <li key={outcome}>{outcome}</li>
                ))}
              </ul>
            </section>
            <section>
              <small>CULMINATING EXPERIENCE</small>
              <h2>How the program concludes</h2>
              <p>{program.culminatingExperience}</p>
            </section>
            <section>
              <small>CURRICULUM MAP</small>
              <h2>Term-by-term study plan</h2>
              <div className={styles.termMap}>
                {terms.map((term) => (
                  <article key={term}>
                    <header>
                      <span>TERM {String(term).padStart(2, "0")}</span>
                      <b>
                        {
                          program.requirements.filter(
                            (item) => item.termNumber === term,
                          ).length
                        }{" "}
                        courses
                      </b>
                    </header>
                    {program.requirements
                      .filter((item) => item.termNumber === term)
                      .map((item) => (
                        <div key={item.id}>
                          <i>{item.type}</i>
                          <span>
                            <b>
                              {item.course.code} · {item.course.title}
                            </b>
                            <small>
                              {item.course.academy} ·{" "}
                              {item.course.workloadHours} hours
                            </small>
                          </span>
                        </div>
                      ))}
                  </article>
                ))}
              </div>
            </section>
          </main>
          <aside>
            <section>
              <small>CREDENTIAL RECORD</small>
              <h3>{program.credentialTitle}</h3>
              <p>
                Issued after all program requirements and the culminating
                assessment are completed.
              </p>
            </section>
            <section>
              <small>CURRICULUM COMPOSITION</small>
              <h3>Not a renamed duplicate</h3>
              {["CORE", "SUPPORTING", "ELECTIVE", "CAPSTONE"].map((type) => (
                <div className={styles.composition} key={type}>
                  <span>{type}</span>
                  <b>
                    {
                      program.requirements.filter((item) => item.type === type)
                        .length
                    }
                  </b>
                </div>
              ))}
            </section>
          </aside>
        </div>
        <footer>
          <div>
            <small>SPONSORED BY</small>
            <b>{program.sponsoredBy}</b>
          </div>
          <button onClick={close}>COMPARE OTHER PATHWAYS</button>
          {program.enrollments.length ? (
            <button className={styles.primary} onClick={close}>
              PROGRAM ACTIVE
            </button>
          ) : program.applications.length ? (
            <button disabled>
              APPLICATION {program.applications[0].status}
            </button>
          ) : (
            <button className={styles.primary} onClick={apply}>
              BEGIN PROGRAM APPLICATION →
            </button>
          )}
        </footer>
      </motion.article>
    </motion.div>
  );
}

function ProgramApplication({
  program,
  close,
  submitted,
}: {
  program: Program;
  close: () => void;
  submitted: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  return (
    <motion.div
      className={styles.modalBack}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.form
        className={styles.applicationModal}
        initial={{ scale: 0.94, y: 18 }}
        animate={{ scale: 1, y: 0 }}
        onSubmit={async (event) => {
          event.preventDefault();
          const response = await fetch("/api/university/programs", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              programId: program.id,
              ...Object.fromEntries(new FormData(event.currentTarget)),
            }),
          });
          const result = await response.json();
          if (!response.ok) setMessage(result.error);
          else await submitted();
        }}
      >
        <button type="button" className={styles.modalClose} onClick={close}>
          ×
        </button>
        <small>SPONSORED PROGRAM APPLICATION</small>
        <h2>{program.title}</h2>
        <p>
          Tell the academic system how this pathway supports your development
          goals. There is no application charge.
        </p>
        <label>
          EXPERIENCE SUMMARY
          <textarea
            name="experience"
            required
            minLength={10}
            placeholder="Your Workbench, scripting, creative, or project experience"
          />
        </label>
        <label>
          WHY THIS PROGRAM
          <textarea
            name="statement"
            required
            minLength={80}
            placeholder="Your goals, intended outcomes, and how you will use the learning"
          />
        </label>
        <label>
          WEEKLY STUDY HOURS
          <input
            name="weeklyHours"
            type="number"
            min="2"
            max="80"
            defaultValue="10"
            required
          />
        </label>
        <div className={styles.modalValue}>
          <span>PROGRAM SPONSORED VALUE</span>
          <b>{money(program.estimatedValueCents)}</b>
          <small>STUDENT RESPONSIBILITY · $0.00</small>
        </div>
        <button className={styles.primary}>SUBMIT APPLICATION →</button>
        {message && <em>{message}</em>}
      </motion.form>
    </motion.div>
  );
}

function AppealForm({ submissionId }: { submissionId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  if (!open)
    return (
      <button className={styles.appealButton} onClick={() => setOpen(true)}>
        REQUEST HUMAN APPEAL
      </button>
    );
  return (
    <form
      className={styles.appealForm}
      onSubmit={async (event) => {
        event.preventDefault();
        const response = await fetch(
          `/api/university/submissions/${submissionId}/appeal`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(
              Object.fromEntries(new FormData(event.currentTarget)),
            ),
          },
        );
        const result = await response.json();
        setMessage(
          response.ok ? "Appeal recorded for faculty review." : result.error,
        );
      }}
    >
      <textarea
        name="reason"
        required
        minLength={80}
        placeholder="Explain the evidence, rubric item, and outcome you want reviewed."
      />
      <button>SUBMIT ONE-TIME APPEAL</button>
      {message && <p>{message}</p>}
    </form>
  );
}

function CoursePlayer({
  course,
  close,
  refresh,
}: {
  course: CourseDetail;
  close: () => void;
  refresh: () => Promise<void>;
}) {
  const firstOpen = course.days.findIndex((day) => !day.progress[0]?.completed);
  const [index, setIndex] = useState(firstOpen < 0 ? 0 : firstOpen);
  const [answer, setAnswer] = useState("");
  const [reflection, setReflection] = useState("");
  const [message, setMessage] = useState("");
  const day = course.days[index];
  async function complete() {
    const response = await fetch(`/api/curriculum/${course.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dayId: day.id, answer, reflection }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error);
      return;
    }
    setMessage(`Day complete · course progress ${result.progress}%`);
    setAnswer("");
    setReflection("");
    await refresh();
  }
  const allDone = course.days.every((item) => item.progress[0]?.completed);
  return (
    <section className={styles.player}>
      <aside className={styles.toc}>
        <button onClick={close}>← BACK TO LEARNING</button>
        <div className={styles.courseIdentity}>
          <span>{course.code}</span>
          <h2>{course.title}</h2>
          <p>{course.academy}</p>
          <ProgressRing
            value={Math.round(
              (course.days.filter((item) => item.progress[0]?.completed)
                .length /
                course.days.length) *
                100,
            )}
          />
        </div>
        <nav aria-label="Course table of contents">
          {course.days.map((item, itemIndex) => (
            <button
              className={`${itemIndex === index ? styles.on : ""} ${item.progress[0]?.completed ? styles.done : ""}`}
              key={item.id}
              onClick={() => setIndex(itemIndex)}
            >
              <i>{item.progress[0]?.completed ? "✓" : item.dayNumber}</i>
              <span>
                <small>DAY {item.dayNumber}</small>
                {item.title}
              </span>
            </button>
          ))}
        </nav>
      </aside>
      <article className={styles.lesson}>
        <header>
          <p>
            DAY {day.dayNumber} OF {course.days.length} /{" "}
            {course.academy.toUpperCase()}
          </p>
          <h1>{day.title}</h1>
          <span>{course.studio}</span>
        </header>
        <section className={styles.objectives}>
          <small>TODAY&apos;S OUTCOMES</small>
          <h2>What you will be able to do</h2>
          <ul>
            {day.objectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ul>
        </section>
        <LessonBlock number="01" title="Instruction">
          <p>{day.instructionalText}</p>
        </LessonBlock>
        <LessonBlock number="02" title="Exact Workbench procedure">
          <ol className={styles.steps}>
            {day.workbenchSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </LessonBlock>
        <LessonBlock number="03" title="Practical lab">
          <p>{day.practicalLab}</p>
          <ul className={styles.checklist}>
            {day.completionChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </LessonBlock>
        {course.sources[0] && (
          <section className={styles.source}>
            <div>
              <small>OFFICIAL TECHNICAL SOURCE</small>
              <h2>{course.sources[0].wikiTitle}</h2>
              <p>{day.sourceSection}</p>
              <span>
                Revision {course.sources[0].revisionId || "awaiting sync"} ·{" "}
                {course.sources[0].syncStatus}
              </span>
            </div>
            <a href={course.sources[0].url} target="_blank" rel="noreferrer">
              OPEN BOHEMIA WIKI ↗
            </a>
          </section>
        )}
        <section className={styles.completion}>
          <small>COMPLETE THE LEARNING LOOP</small>
          <h2>Check your understanding</h2>
          <label>
            {day.knowledgeQuestion}
            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Explain your answer with technical evidence…"
            />
          </label>
          <label>
            {day.reflectionPrompt}
            <textarea
              value={reflection}
              onChange={(event) => setReflection(event.target.value)}
              placeholder="Record the decision, evidence, and next verification…"
            />
          </label>
          <button onClick={complete}>COMPLETE DAY {day.dayNumber} →</button>
          {message && <p>{message}</p>}
        </section>
        {allDone && course.enrollments[0]?.status !== "COMPLETED" && (
          <FinalSubmission course={course} />
        )}
        <footer className={styles.lessonNav}>
          <button disabled={index === 0} onClick={() => setIndex(index - 1)}>
            ← PREVIOUS
          </button>
          <span>
            {index + 1} / {course.days.length}
          </span>
          <button
            disabled={index === course.days.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            NEXT DAY →
          </button>
        </footer>
      </article>
    </section>
  );
}

function LessonBlock({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.lessonBlock}>
      <header>
        <span>{number}</span>
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}
function FinalSubmission({ course }: { course: CourseDetail }) {
  const [message, setMessage] = useState("");
  return (
    <form
      className={styles.finalSubmission}
      onSubmit={async (event) => {
        event.preventDefault();
        const response = await fetch("/api/academy", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "submit_mod",
            courseId: course.id,
            ...Object.fromEntries(new FormData(event.currentTarget)),
          }),
        });
        const result = await response.json();
        setMessage(
          response.ok
            ? "Assessment queued. Gemini will grade against the rubric and mapped Bohemia sources."
            : result.error,
        );
      }}
    >
      <small>FINAL INTELLIGENT ASSESSMENT</small>
      <h2>Submit your studio artifact</h2>
      <p>
        {course.deliverable} Provide a complete technical record and public
        evidence where available; no project files are uploaded or stored.
      </p>
      <input name="title" required minLength={3} placeholder="Artifact title" />
      <textarea
        name="summary"
        required
        minLength={30}
        placeholder="Explain the outcome, architecture, tests, evidence, and lessons learned…"
      />
      <input
        name="referenceUrl"
        type="url"
        placeholder="Optional Workshop, wiki, video, or issue reference"
      />
      <input
        name="demoUrl"
        type="url"
        placeholder="Optional public demonstration URL"
      />
      <button>QUEUE INTELLIGENT REVIEW →</button>
      {message && <p>{message}</p>}
    </form>
  );
}
