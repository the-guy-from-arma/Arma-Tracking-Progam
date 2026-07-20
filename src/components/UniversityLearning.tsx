"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { UniversityView } from "./UniversityPortal";
import styles from "./UniversityLearning.module.css";
import { StudentCenter } from "./StudentCenter";
import { StudentProfile } from "./StudentProfile";
import { facultyForAcademy } from "@/lib/ai-faculty";
import { FacultyMessages } from "./FacultyMessages";
import { FacultyCommons } from "./FacultyCommons";
import { StudentPolicies } from "./StudentPolicies";
import {
  ArrowRight,
  Award,
  Banknote,
  BookOpenCheck,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Compass,
  GraduationCap,
  MessageCircle,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { AcademicLoader } from "./AcademicLoader";

type Enrollment = { id: string; status: string; progress: number };
type ProgramEnrollment = {
  id: string;
  status: string;
  creditsEarned: number;
  enrolledAt: string;
  completedAt: string | null;
  withdrawnAt: string | null;
  programChangePenaltyBps: number;
};
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
  fulfilled: boolean;
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
  serviceCounts: {
    openApplications: number;
    activeEnrollments: number;
    pendingSubmissions: number;
    unreadFeedback: number;
    credentials: number;
  };
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
  enrollments: ProgramEnrollment[];
  applications: { id: string; status: string }[];
  audit: {
    fulfilledCourseIds: string[];
    fulfilledRequirementIds: string[];
    fulfilledCourses: number;
    totalCourses: number;
    creditsApplied: number;
    creditsRequired: number;
    remainingCredits: number;
    progressPercent: number;
    nextCourseId: string | null;
    eligible: boolean;
    prerequisiteLevel: string | null;
    prerequisiteProgramId: string | null;
    blocker: string | null;
  };
  registrationSummary: {
    required: number;
    registered: number;
    missing: number;
    withdrawn: number;
    missingCourseCodes: string[];
    withdrawnCourseCodes: string[];
    unregisteredValueCents: number;
  };
};
type ProgramsData = { programs: Program[]; degreeWordingEnabled: boolean };
type EnrollmentConfirmation =
  | { kind: "COURSE"; course: CourseDetail }
  | { kind: "PROGRAM"; program: Program };
type ProgramChangeSelection = { from: Program; to: Program };
type FundingData = {
  balanceCents: number;
  pendingCents: number;
  usedCents: number;
  expiringSoonCents: number;
  reconciled: boolean;
  varianceCents: number;
  studentResponsibilityCents: number;
  awards: {
    id: string;
    referenceNumber: string;
    sourceName: string;
    type: string;
    status: string;
    originalAmountCents: number;
    remainingAmountCents: number;
    awardedAt: string;
    expiresAt: string | null;
    publicDescription: string;
    restrictions: string;
    issuingDepartment: string;
    transactions: {
      id: string;
      description: string;
      amountCents: number;
      createdAt: string;
      type: string;
      publicReason: string | null;
    }[];
  }[];
  ledger: {
    id: string;
    type: string;
    amountCents: number;
    description: string;
    createdAt: string;
    runningBalanceCents: number | null;
    publicReason: string | null;
    fundingAward: { referenceNumber: string; sourceName: string } | null;
    course: { code: string; title: string } | null;
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
type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};
type NotificationData = {
  notifications: NotificationItem[];
  unread: number;
};
type NewsletterArticle = {
  id: string;
  position: number;
  desk: string;
  headline: string;
  summary: string;
  sourceTitle: string;
  sourceUrl: string;
  revisionId: string | null;
  sourceUpdatedAt: string | null;
  image: {
    url: string;
    altText: string;
    caption: string | null;
    width: number | null;
    height: number | null;
    filePageUrl: string | null;
  } | null;
  relatedCourses: { id: string; code: string; title: string; academy: string }[];
};
type NewsletterData = {
  publication: string;
  edition: string;
  publishedAt: string;
  headline: string;
  deck: string;
  sourceCount: number;
  desks: string[];
  articles: NewsletterArticle[];
  attribution: string;
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
  facultySlug,
  onOpenFaculty,
  courseSelectionEnabled,
  programSelectionEnabled,
  onSelectionUnavailable,
}: {
  view: UniversityView;
  userName: string;
  onNavigate: (view: UniversityView) => void;
  facultySlug?: string | null;
  onOpenFaculty: (slug: string) => void;
  courseSelectionEnabled: boolean;
  programSelectionEnabled: boolean;
  onSelectionUnavailable: () => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<Curriculum | null>(null);
  const [records, setRecords] = useState<AcademyData | null>(null);
  const [programs, setPrograms] = useState<ProgramsData | null>(null);
  const [funding, setFunding] = useState<FundingData | null>(null);
  const [notifications, setNotifications] = useState<NotificationData | null>(
    null,
  );
  const [newsletter, setNewsletter] = useState<NewsletterData | null>(null);
  const [selected, setSelected] = useState<CourseDetail | null>(null);
  const [previewCourse, setPreviewCourse] = useState<CourseDetail | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [comparingProgram, setComparingProgram] = useState<Program | null>(null);
  const [activeAnnouncement, setActiveAnnouncement] =
    useState<NotificationItem | null>(null);
  const [search, setSearch] = useState("");
  const [academy, setAcademy] = useState("ALL");
  const [level, setLevel] = useState("ALL");
  const [enrollmentConfirmation, setEnrollmentConfirmation] =
    useState<EnrollmentConfirmation | null>(null);
  const [programChange, setProgramChange] =
    useState<ProgramChangeSelection | null>(null);
  const [error, setError] = useState("");
  const [renderedAt] = useState(() => Date.now());

  const load = useCallback(async () => {
    const responses = await Promise.all([
      fetch("/api/curriculum"),
      fetch("/api/academy"),
      fetch("/api/university/programs"),
      fetch("/api/university/funding"),
      fetch("/api/university/notifications"),
      fetch("/api/university/newsletter"),
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
    if (responses[5].ok) setNewsletter(payloads[5]);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function openCourse(id: string) {
    router.push(`/university/courses/${id}`);
  }
  async function preview(id: string) {
    router.push(`/university/courses/${id}`);
  }
  async function openAnnouncement(item: NotificationItem) {
    setActiveAnnouncement(item);
    if (item.readAt) return;
    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current
        ? {
            ...current,
            unread: Math.max(0, current.unread - 1),
            notifications: current.notifications.map((notice) =>
              notice.id === item.id ? { ...notice, readAt } : notice,
            ),
          }
        : current,
    );
    await fetch("/api/university/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    }).catch(() => undefined);
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
  const activeProgram = useMemo(
    () =>
      programs?.programs.find((program) =>
        program.enrollments.some((item) => item.status === "ACTIVE"),
      ) || null,
    [programs],
  );
  if (!data)
    return (
      <AcademicLoader
        label={error || "Opening your campus"}
        error={Boolean(error)}
      />
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

  if (view === "student-center")
    return (
      <StudentCenter
        courseSelectionEnabled={courseSelectionEnabled}
        onSelectionUnavailable={onSelectionUnavailable}
      />
    );
  if (view === "messages")
    return (
      <FacultyMessages
        initialFacultySlug={facultySlug || undefined}
        onOpenDirectory={() => onNavigate("faculty")}
      />
    );
  if (view === "faculty") return <FacultyCommons onMessage={onOpenFaculty} />;
  if (view === "policies") return <StudentPolicies />;
  if (view === "profile") return <StudentProfile />;

  if (view === "dashboard")
    return (
      <CampusHomeDashboard
        data={data}
        records={records}
        funding={funding}
        newsletter={newsletter}
        userName={userName}
        onNavigate={onNavigate}
        openCourse={openCourse}
      />
    );

  if (view === ("legacy-dashboard" as UniversityView)) {
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
            <p>ENSCRIPT UNIVERSITY · STUDENT CAMPUS</p>
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
                <i>
                  <ClipboardList size={18} />
                </i>
                <span>
                  <b>Student Center</b>
                  <small>
                    {data.serviceCounts.openApplications} applications ·{" "}
                    {data.serviceCounts.activeEnrollments} active courses
                  </small>
                </span>
              </button>
              <button onClick={() => onNavigate("funding")}>
                <i>
                  <Banknote size={18} />
                </i>
                <span>
                  <b>Funding Center</b>
                  <small>
                    {money(funding?.balanceCents ?? data.grantBalanceCents)}{" "}
                    available · {money(funding?.expiringSoonCents || 0)}{" "}
                    expiring
                  </small>
                </span>
              </button>
              <button onClick={() => onNavigate("submissions")}>
                <i>
                  <BookOpenCheck size={18} />
                </i>
                <span>
                  <b>Assignments & Grades</b>
                  <small>
                    {data.serviceCounts.pendingSubmissions} pending ·{" "}
                    {data.serviceCounts.unreadFeedback} feedback records
                  </small>
                </span>
              </button>
              <button onClick={() => onNavigate("credentials")}>
                <i>
                  <Award size={18} />
                </i>
                <span>
                  <b>Credentials</b>
                  <small>
                    {data.serviceCounts.credentials} earned · next milestone in
                    Learning
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
                    onClick={() => void openAnnouncement(item)}
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
              <small>FACULTY COMMONS · AVAILABLE NOW</small>
              {[
                "Workbench Foundations",
                "Enforce Script",
                "Terrain and World Building",
              ].map((academy) => {
                const faculty = facultyForAcademy(academy);
                return (
                  <article key={faculty.id}>
                    <i>{faculty.initials}</i>
                    <span>
                      <b>{faculty.name}</b>
                      <p>{faculty.specialty}</p>
                    </span>
                    <em>ONLINE</em>
                  </article>
                );
              })}
            </section>
          </aside>
        </div>
        <AnimatePresence>
          {activeAnnouncement && (
            <AnnouncementReader
              item={activeAnnouncement}
              close={() => setActiveAnnouncement(null)}
            />
          )}
        </AnimatePresence>
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
                className={styles.courseTitleButton}
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
              {course.fulfilled ? (
                <button disabled>COMPLETED · CREDIT ON RECORD</button>
              ) : course.enrollments.length ? (
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
              enroll={() => {
                if (!courseSelectionEnabled) {
                  setPreviewCourse(null);
                  onSelectionUnavailable();
                  return;
                }
                setEnrollmentConfirmation({
                  kind: "COURSE",
                  course: previewCourse,
                });
                setPreviewCourse(null);
              }}
            />
          )}
          {enrollmentConfirmation?.kind === "COURSE" && (
            <EnrollmentConfirmationModal
              confirmation={enrollmentConfirmation}
              availableBalanceCents={data.grantBalanceCents}
              close={() => setEnrollmentConfirmation(null)}
              confirmed={async () => {
                const courseId = enrollmentConfirmation.course.id;
                setEnrollmentConfirmation(null);
                await load();
                await openCourse(courseId);
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
        <div className={styles.editorialProgramGrid}>
          {filteredPrograms.map((program, index) => (
            <motion.article
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 12) * 0.035 }}
              className={styles.editorialProgramCard}
              key={program.id}
            >
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
                className={styles.editorialProgramTitle}
                onClick={() => setSelectedProgram(program)}
              >
                <h2>{program.title}</h2>
                <span>EXPLORE THE FULL PATHWAY →</span>
              </button>
              <p>{program.summary}</p>
              <div className={styles.editorialProgramStats}>
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
              <div className={styles.editorialProgramValue}>
                <span>PROGRAM SPONSORED VALUE</span>
                <b>{money(program.estimatedValueCents)}</b>
              </div>
              {program.audit.fulfilledCourses > 0 && (
                <div className={styles.editorialTransferCredit}>
                  <b>{program.audit.creditsApplied} credits already applied</b>
                  <span>
                    {program.audit.fulfilledCourses} of{" "}
                    {program.audit.totalCourses} required courses fulfilled
                  </span>
                </div>
              )}
              <button
                className={styles.editorialProgramAction}
                onClick={() => setSelectedProgram(program)}
              >
                {program.enrollments.some((item) => item.status === "ACTIVE") && program.registrationSummary.withdrawn
                  ? `RESOLVE ${program.registrationSummary.withdrawn} WITHDRAWN COURSE${program.registrationSummary.withdrawn === 1 ? "" : "S"} →`
                  : program.enrollments.some((item) => item.status === "ACTIVE") && program.registrationSummary.missing
                  ? `REGISTER ${program.registrationSummary.missing} REQUIRED COURSE${program.registrationSummary.missing === 1 ? "" : "S"} →`
                  : program.enrollments.some((item) => item.status === "ACTIVE")
                    ? "VIEW ACTIVE PROGRAM →"
                    : "READ PROGRAM DETAILS →"}
              </button>
            </motion.article>
          ))}
        </div>
        <AnimatePresence>
          {selectedProgram && (
            <ProgramDetail
              key={selectedProgram.id}
              program={selectedProgram}
              close={() => setSelectedProgram(null)}
              compare={() => setComparingProgram(selectedProgram)}
              advising={() => {
                setSelectedProgram(null);
                onNavigate("student-center");
              }}
              enroll={() => {
                if (!programSelectionEnabled) {
                  setSelectedProgram(null);
                  onSelectionUnavailable();
                  return;
                }
                if (activeProgram && activeProgram.id !== selectedProgram.id) {
                  setProgramChange({ from: activeProgram, to: selectedProgram });
                } else {
                  setEnrollmentConfirmation({
                    kind: "PROGRAM",
                    program: selectedProgram,
                  });
                }
                setSelectedProgram(null);
              }}
            />
          )}{" "}
          {comparingProgram && programs && (
            <ProgramComparison
              key={`compare-${comparingProgram.id}`}
              program={comparingProgram}
              programs={programs.programs}
              close={() => setComparingProgram(null)}
              openProgram={(nextProgram) => {
                setComparingProgram(null);
                setSelectedProgram(nextProgram);
              }}
            />
          )}
          {enrollmentConfirmation?.kind === "PROGRAM" && (
            <EnrollmentConfirmationModal
              confirmation={enrollmentConfirmation}
              availableBalanceCents={data.grantBalanceCents}
              close={() => setEnrollmentConfirmation(null)}
              confirmed={async () => {
                setEnrollmentConfirmation(null);
                await load();
              }}
            />
          )}
          {programChange && (
            <ProgramChangeModal
              selection={programChange}
              close={() => setProgramChange(null)}
              confirmed={async () => {
                setProgramChange(null);
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
    return <WeeklyNewsletter data={newsletter} openCourse={openCourse} />;
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
            <div className={styles.seal}>ES</div>
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

function CampusHomeDashboard({
  data,
  records,
  funding,
  newsletter,
  userName,
  onNavigate,
  openCourse,
}: {
  data: Curriculum;
  records: AcademyData | null;
  funding: FundingData | null;
  newsletter: NewsletterData | null;
  userName: string;
  onNavigate: (view: UniversityView) => void;
  openCourse: (id: string) => Promise<void>;
}) {
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
  const progress = totalDays ? Math.round((doneDays / totalDays) * 100) : 0;
  const remainingDays = Math.max(0, totalDays - doneDays);
  const firstName = userName.split(" ")[0];
  const services = [
    {
      label: "Student Center",
      detail: `${data.serviceCounts.activeEnrollments} active · ${data.serviceCounts.openApplications} applications`,
      value: data.serviceCounts.activeEnrollments,
      icon: ClipboardList,
      view: "student-center" as UniversityView,
    },
    {
      label: "Funding",
      detail: `${money(funding?.balanceCents ?? data.grantBalanceCents)} available`,
      value: funding?.expiringSoonCents ? "Review" : "Current",
      icon: Banknote,
      view: "funding" as UniversityView,
    },
    {
      label: "Assignments",
      detail: `${data.serviceCounts.pendingSubmissions} pending · ${data.serviceCounts.unreadFeedback} feedback`,
      value: data.serviceCounts.pendingSubmissions,
      icon: BookOpenCheck,
      view: "submissions" as UniversityView,
    },
    {
      label: "Credentials",
      detail: `${data.serviceCounts.credentials} earned`,
      value: data.serviceCounts.credentials,
      icon: Award,
      view: "credentials" as UniversityView,
    },
  ];

  return (
    <section className={`${styles.learning} ${styles.campusHome}`}>
      <motion.header
        className={styles.campusStage}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={styles.campusAurora} aria-hidden="true" />
        <div className={styles.campusStageCopy}>
          <p className={styles.campusKicker}>
            <span /> Enscript University · Student Campus
          </p>
          <h1>
            Good to see you,
            <em>{firstName}.</em>
          </h1>
          <p className={styles.campusStageLead}>
            {next
              ? `Your next studio session is ready in ${next.code}.`
              : "Your academic space is ready. Choose where you want to begin."}
          </p>
          <div className={styles.campusStageActions}>
            <button
              className={styles.campusPrimaryAction}
              onClick={() =>
                next ? void openCourse(next.id) : onNavigate("catalog")
              }
            >
              {next ? "Continue learning" : "Explore the course catalog"}
              <ArrowRight size={18} />
            </button>
            <button
              className={styles.campusTextAction}
              onClick={() => onNavigate("messages")}
            >
              <MessageCircle size={17} /> Message your advisor
            </button>
          </div>
        </div>

        <div className={styles.campusProgressScene}>
          <motion.div
            className={styles.campusProgressHalo}
            initial={{ scale: 0.88, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.18, duration: 0.7 }}
            style={
              { "--campus-progress": `${progress * 3.6}deg` } as React.CSSProperties
            }
          >
            <span>
              <strong>{progress}%</strong>
              <small>coursework</small>
            </span>
          </motion.div>
          <div className={styles.campusProgressCaption}>
            <Sparkles size={16} />
            <span>
              <b>{doneDays} days completed</b>
              <small>{remainingDays} remain in your active courses</small>
            </span>
          </div>
        </div>
      </motion.header>

      <nav className={styles.campusDock} aria-label="Campus services">
        {services.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.06 }}
              whileHover={{ y: -4 }}
              onClick={() => onNavigate(item.view)}
            >
              <i><Icon size={19} /></i>
              <span>
                <b>{item.label}</b>
                <small>{item.detail}</small>
              </span>
              <em>{item.value}</em>
              <ChevronRight size={17} />
            </motion.button>
          );
        })}
      </nav>

      <div className={styles.campusFlow}>
        <main className={styles.learningPath}>
          <header className={styles.campusSectionHeading}>
            <div>
              <p>Your learning path</p>
              <h2>Pick up where you left off</h2>
            </div>
            <button onClick={() => onNavigate("learning")}>
              View all learning <ArrowRight size={16} />
            </button>
          </header>

          {data.enrolled.length ? (
            <div className={styles.learningRunway}>
              {data.enrolled.slice(0, 5).map((course, index) => (
                <motion.button
                  key={course.id}
                  className={styles.runwayCourse}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.16 + index * 0.07 }}
                  onClick={() => void openCourse(course.id)}
                >
                  <span className={styles.runwayMarker}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={styles.runwayIdentity}>
                    <small>{course.code} · {course.academy}</small>
                    <b>{course.title}</b>
                    <em>
                      Day {Math.min(course._count.days, course.completedDays + 1)} of {course._count.days}
                    </em>
                  </span>
                  <span className={styles.runwayProgress}>
                    <i><span style={{ width: `${percent(course)}%` }} /></i>
                    <b>{percent(course)}%</b>
                  </span>
                  <ArrowRight size={19} />
                </motion.button>
              ))}
            </div>
          ) : (
            <motion.div
              className={styles.emptyLearningPath}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.18 }}
            >
              <div className={styles.emptyPathArt} aria-hidden="true">
                <Compass size={42} />
                <span /><span /><span />
              </div>
              <div>
                <p>Ready when you are</p>
                <h3>Choose your first studio course.</h3>
                <span>
                  Explore guided courses or ask your advisor to shape a starting path.
                </span>
              </div>
              <button onClick={() => onNavigate("catalog")}>
                Discover courses <ArrowRight size={17} />
              </button>
            </motion.div>
          )}

          <div className={styles.academicRibbon}>
            <article>
              <GraduationCap size={20} />
              <span><b>{records?.learningCredits || 0}</b><small>credits completed</small></span>
            </article>
            <article>
              <TrendingUp size={20} />
              <span><b>{doneDays}</b><small>learning days finished</small></span>
            </article>
            <article>
              <BookOpenCheck size={20} />
              <span><b>{data.coverage.mapped}</b><small>verified curriculum sources</small></span>
            </article>
            <button onClick={() => onNavigate("profile")}>
              Open academic record <ArrowRight size={16} />
            </button>
          </div>
        </main>

        <aside className={styles.campusPulse}>
          <header className={styles.campusSectionHeading}>
            <div>
              <p>Development weekly</p>
              <h2>From the field</h2>
            </div>
            <span>EDITION {newsletter?.edition || "—"}</span>
          </header>
          <div className={styles.campusNewsStream}>
            {newsletter?.articles.slice(0, 4).map((item, index) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.18 + index * 0.06 }}
                onClick={() => onNavigate("notifications")}
              >
                <i className={styles.newsRead}>{String(index + 1).padStart(2, "0")}</i>
                <span>
                  <small>{item.desk}</small>
                  <b>{item.headline}</b>
                  <p>{item.summary}</p>
                </span>
                <ChevronRight size={17} />
              </motion.button>
            ))}
            {!newsletter?.articles.length && (
              <div className={styles.campusQuietState}>
                <Sparkles size={21} />
                <span><b>The next issue is in production.</b><small>Verified development reporting will appear here.</small></span>
              </div>
            )}
          </div>
          <button
            className={styles.campusNewsLink}
            onClick={() => onNavigate("notifications")}
          >
            Read this week’s issue <ArrowRight size={16} />
          </button>

          <div className={styles.nextDateLine}>
            <CalendarDays size={21} />
            <span>
              <small>Next important date</small>
              <b>Sponsored funding renewal</b>
              <em>
                {activeTerm
                  ? new Date(activeTerm.endsAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Begins with your active term"}
              </em>
            </span>
          </div>
        </aside>
      </div>

      <section className={styles.facultyWalkway}>
        <div>
          <p>Faculty commons</p>
          <h2>Support is part of the campus.</h2>
          <button onClick={() => onNavigate("messages")}>
            Visit messages <ArrowRight size={16} />
          </button>
        </div>
        <div className={styles.facultyWalkwayPeople}>
          {["Workbench Foundations", "Enforce Script", "Terrain and World Building"].map(
            (academy, index) => {
              const faculty = facultyForAcademy(academy);
              return (
                <motion.article
                  key={faculty.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.26 + index * 0.07 }}
                >
                  <i>{faculty.initials}</i>
                  <span><b>{faculty.name}</b><small>{faculty.specialty}</small></span>
                  <em><span /> Available</em>
                </motion.article>
              );
            },
          )}
        </div>
      </section>

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
        <small>FACULTY</small>
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
  if (!data) return <AcademicLoader label="Preparing your funding statement" />;
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
        copy="A complete record of internal, noncash educational sponsorship applied to your Enscript University study."
        count="YOU OWE $0.00"
      />
      <div className={styles.valueDisclosure}>
        <b>INTERNAL STATISTICAL VALUE · NEVER STUDENT DEBT</b>
        <span>
          Every dollar figure is a noncash learning-service measurement. It is
          not tuition, financial aid, a loan, cash, stored value, or a
          collectible balance. Student responsibility is always $0.00.
        </span>
        <Link href="/policies/sponsored-value-no-debt">
          Read the complete Sponsored Value and No-Debt Disclosure →
        </Link>
      </div>
      <section
        className={styles.fundingSummary}
        aria-label="Sponsored-learning account summary"
      >
        <article>
          <small>AVAILABLE</small>
          <b>{money(data.balanceCents)}</b>
          <span>Eligible learning services</span>
        </article>
        <article>
          <small>PENDING</small>
          <b>{money(data.pendingCents)}</b>
          <span>Not yet available</span>
        </article>
        <article>
          <small>USED</small>
          <b>{money(data.usedCents)}</b>
          <span>Allocated to learning</span>
        </article>
        <article>
          <small>EXPIRING SOON</small>
          <b>{money(data.expiringSoonCents)}</b>
          <span>Within 30 days</span>
        </article>
      </section>
      {!data.reconciled && (
        <p className={styles.reconcileNotice}>
          Source detail is being reconciled. The authoritative available balance
          remains {money(data.balanceCents)}; no student action or payment is
          required.
        </p>
      )}
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
      <section className={styles.awardSources}>
        <SectionHead
          eyebrow="FUNDING SOURCES"
          title="Awards and sponsored value"
          action={`${data.awards.length} SOURCES`}
        />
        <div>
          {data.awards.map((award) => (
            <details key={award.id}>
              <summary>
                <span>
                  <small>
                    {award.type.replaceAll("_", " ")} · {award.referenceNumber}
                  </small>
                  <b>{award.sourceName}</b>
                  <em>{award.publicDescription}</em>
                </span>
                <span>
                  <strong>{money(award.remainingAmountCents)}</strong>
                  <small>of {money(award.originalAmountCents)} available</small>
                </span>
              </summary>
              <div className={styles.awardDetail}>
                <dl>
                  <div>
                    <dt>Status</dt>
                    <dd>{award.status.replaceAll("_", " ")}</dd>
                  </div>
                  <div>
                    <dt>Issued</dt>
                    <dd>{new Date(award.awardedAt).toLocaleDateString()}</dd>
                  </div>
                  <div>
                    <dt>Expiration</dt>
                    <dd>
                      {award.expiresAt
                        ? new Date(award.expiresAt).toLocaleDateString()
                        : "No scheduled expiration"}
                    </dd>
                  </div>
                  <div>
                    <dt>Issuing department</dt>
                    <dd>{award.issuingDepartment}</dd>
                  </div>
                </dl>
                <p>
                  <b>Restrictions:</b> {award.restrictions}
                </p>
                <h3>Source activity</h3>
                {award.transactions.length ? (
                  award.transactions.map((entry) => (
                    <article key={entry.id}>
                      <span>
                        {new Date(entry.createdAt).toLocaleDateString()} ·{" "}
                        {entry.description}
                      </span>
                      <b>
                        {entry.amountCents >= 0 ? "+" : ""}
                        {money(entry.amountCents)}
                      </b>
                    </article>
                  ))
                ) : (
                  <p>No source-linked transactions are recorded yet.</p>
                )}
              </div>
            </details>
          ))}
        </div>
        <Link
          className={styles.statementLink}
          href="/api/university/documents/sponsored-learning-statement"
        >
          DOWNLOAD RECONCILED STATEMENT →
        </Link>
      </section>
    </section>
  );
}

function WeeklyNewsletter({
  data,
  openCourse,
}: {
  data: NewsletterData | null;
  openCourse: (id: string) => Promise<void>;
}) {
  const lead = data?.articles[0];
  const briefing = data?.articles.slice(1, 7) || [];
  return (
    <section className={`${styles.learning} ${styles.weeklyPublication}`}>
      <header className={styles.weeklyMasthead}>
        <div className={styles.weeklyIdentity}>
          <span>ENSCRIPT UNIVERSITY · ACADEMIC EDITORIAL OFFICE</span>
          <h1>Enscript Development Weekly</h1>
          <p>Enfusion Workbench · Arma Reforger · Enforce Script · Studio Practice</p>
        </div>
        <div className={styles.weeklyEdition}>
          <span>WEEKLY EDITION</span>
          <b>{data?.edition || "PREPARING"}</b>
          <time dateTime={data?.publishedAt}>
            {data?.publishedAt
              ? new Date(data.publishedAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : "Publication date pending"}
          </time>
        </div>
      </header>

      <div className={styles.weeklyRule}>
        <span>{data?.sourceCount || 0} VERIFIED SOURCE REPORTS</span>
        <span>{data?.desks.join(" · ") || "ACADEMIC EDITION IN PRODUCTION"}</span>
      </div>

      {lead ? (
        <>
          <article className={styles.weeklyLead}>
            <div className={styles.weeklyLeadCopy}>
              <span>{lead.desk}</span>
              <h2>{lead.headline}</h2>
              <p className={styles.weeklyDeck}>{data?.deck}</p>
              <p>{lead.summary}</p>
              <footer>
                <a href={lead.sourceUrl} target="_blank" rel="noreferrer">
                  Read the attributed source <ArrowRight size={16} />
                </a>
                <small>Revision {lead.revisionId || "record pending"}</small>
              </footer>
            </div>
            <figure className={styles.weeklyLeadVisual}>
              {lead.image ? (
                <Image
                  src={lead.image.url}
                  alt={lead.image.altText}
                  width={lead.image.width || 1200}
                  height={lead.image.height || 720}
                />
              ) : (
                <div aria-hidden="true"><span>ES</span><b>FIELD<br />REPORT</b></div>
              )}
              <figcaption>{lead.image?.caption || `${lead.sourceTitle} · Bohemia Interactive Community Wiki`}</figcaption>
            </figure>
          </article>

          <div className={styles.weeklyBody}>
            <main>
              <header className={styles.weeklySectionTitle}>
                <span>THE WEEK IN DEVELOPMENT</span>
                <h2>Workbench briefings</h2>
              </header>
              <div className={styles.weeklyArticleGrid}>
                {briefing.map((item, index) => (
                  <article key={item.id}>
                    {item.image && index < 2 && (
                      <figure>
                        <Image
                          src={item.image.url}
                          alt={item.image.altText}
                          width={item.image.width || 900}
                          height={item.image.height || 540}
                        />
                      </figure>
                    )}
                    <span>{item.desk}</span>
                    <h3>{item.headline}</h3>
                    <p>{item.summary}</p>
                    <div>
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer">SOURCE ↗</a>
                      <small>{item.revisionId ? `REV. ${item.revisionId}` : "CURRENT SOURCE"}</small>
                    </div>
                  </article>
                ))}
              </div>
            </main>

            <aside className={styles.weeklySidebar}>
              <section>
                <span>ACADEMIC CONNECTIONS</span>
                <h2>Continue the subject</h2>
                <p>Courses connected to this week’s verified reporting.</p>
                {[...new Map(data?.articles.flatMap((article) => article.relatedCourses).map((course) => [course.id, course])).values()]
                  .slice(0, 6)
                  .map((course) => (
                    <button key={course.id} onClick={() => void openCourse(course.id)}>
                      <small>{course.code} · {course.academy}</small>
                      <b>{course.title}</b>
                      <ChevronRight size={16} />
                    </button>
                  ))}
              </section>
              <section className={styles.weeklySourceNote}>
                <span>SOURCE STANDARD</span>
                <h2>How this issue is built</h2>
                <p>{data?.attribution}</p>
                <p>Each report links to the exact external source record used by the university. Screenshots remain hosted by Bohemia and appear with source attribution.</p>
              </section>
            </aside>
          </div>
        </>
      ) : (
        <div className={styles.weeklyEmpty}>
          <BookOpenCheck size={34} />
          <span>THE NEXT EDITION IS IN PRODUCTION</span>
          <h2>Source verification is underway.</h2>
          <p>The newsletter will publish when approved Bohemia Wiki sources have a successful revision record. Account alerts remain available from the Alerts button above.</p>
        </div>
      )}

      <footer className={styles.weeklyFooter}>
        <b>ENSCRIPT DEVELOPMENT WEEKLY</b>
        <span>CREATE · BUILD · INNOVATE</span>
        <small>Published for the Enscript University student community.</small>
      </footer>
    </section>
  );
}

function AnnouncementReader({
  item,
  close,
}: {
  item: NotificationItem;
  close: () => void;
}) {
  return (
    <motion.div
      className={styles.newsReaderBack}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <motion.article
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-reader-title"
        initial={{ opacity: 0, y: 24, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12 }}
      >
        <header>
          <span>
            <small>CAMPUS ANNOUNCEMENT</small>
            <b>{item.type}</b>
          </span>
          <button onClick={close} aria-label="Close announcement">
            ×
          </button>
        </header>
        <time>{new Date(item.createdAt).toLocaleString()}</time>
        <h2 id="announcement-reader-title">{item.title}</h2>
        <div className={styles.newsRule} />
        <p>{item.body}</p>
        <footer>
          <button onClick={close}>Done reading</button>
          {item.actionUrl?.startsWith("/") && (
            <Link href={item.actionUrl}>Open related record →</Link>
          )}
        </footer>
      </motion.article>
    </motion.div>
  );
}

function CoursePreview({
  course,
  close,
  open,
  advisor,
  enroll,
}: {
  course: CourseDetail;
  close: () => void;
  open: () => void;
  advisor: () => void;
  enroll: () => void;
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
          {!active && <button onClick={advisor}>ASK YOUR ADVISOR</button>}
          <button className={styles.primary} onClick={active ? open : enroll}>
            {active ? "ENTER COURSE →" : "REVIEW & CONFIRM ENROLLMENT →"}
          </button>
        </footer>
      </motion.article>
    </motion.div>
  );
}

function ProgramDetail({
  program,
  close,
  compare,
  advising,
  enroll,
}: {
  program: Program;
  close: () => void;
  compare: () => void;
  advising: () => void;
  enroll: () => void;
}) {
  const terms = [
    ...new Set(program.requirements.map((item) => item.termNumber)),
  ];
  const faculty = facultyForAcademy(program.academy);
  const isActive = program.enrollments.some((item) => item.status === "ACTIVE");
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
            <div className={styles.detailInstitution}>
              ENSCRIPT UNIVERSITY · SCHOOL OF {program.academy.toUpperCase()}
            </div>
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
        <section className={styles.degreeAudit}>
          <div>
            <small>YOUR ACADEMIC RECORD</small>
            <h2>
              {program.audit.creditsApplied} credits transfer into this pathway
            </h2>
            <p>
              Completed certificate courses are never repeated. Credit is
              applied only when the exact course is a requirement in this
              curriculum.
            </p>
          </div>
          <div className={styles.auditProgress}>
            <span style={{ width: `${program.audit.progressPercent}%` }} />
          </div>
          <b>
            {program.audit.fulfilledCourses} / {program.audit.totalCourses}{" "}
            COURSES FULFILLED
          </b>
          {!program.audit.eligible && <em>{program.audit.blocker}</em>}
          {program.registrationSummary.withdrawn > 0 && (
            <em>
              {program.registrationSummary.withdrawnCourseCodes.join(", ")} was
              previously withdrawn. Its funding history is preserved, and
              Student Center advising must approve a future-term re-entry.
            </em>
          )}
        </section>
        <div className={styles.detailBody}>
          <main>
            <section className={styles.programJourney}>
              <small>YOUR PATH THROUGH THE PROGRAM</small>
              <div>
                <span>
                  <b>01</b>
                  <em>FOUNDATION</em>
                  <p>
                    Establish the technical language and repeatable working
                    methods.
                  </p>
                </span>
                <i />
                <span>
                  <b>02</b>
                  <em>STUDIO PRACTICE</em>
                  <p>
                    Apply those methods through increasingly independent
                    development work.
                  </p>
                </span>
                <i />
                <span>
                  <b>03</b>
                  <em>CULMINATING WORK</em>
                  <p>
                    Demonstrate mastery in a documented, assessable final
                    experience.
                  </p>
                </span>
              </div>
            </section>
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
                        <div
                          key={item.id}
                          className={
                            program.audit.fulfilledCourseIds.includes(
                              item.course.id,
                            )
                              ? styles.requirementComplete
                              : item.course.id === program.audit.nextCourseId
                                ? styles.requirementNext
                                : undefined
                          }
                        >
                          <i>
                            {program.audit.fulfilledCourseIds.includes(
                              item.course.id,
                            )
                              ? "CREDIT APPLIED"
                              : item.course.id === program.audit.nextCourseId
                                ? "NEXT COURSE"
                                : item.type}
                          </i>
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
            <section className={styles.programFaculty}>
              <small>PROGRAM FACULTY</small>
              <div>
                <i>{faculty.initials}</i>
                <span>
                  <h3>{faculty.name}</h3>
                  <b>
                    {faculty.title
                      .replace("AI Faculty · ", "")
                      .replace("AI Dean", "Dean")}
                  </b>
                </span>
              </div>
              <blockquote>“{faculty.voice}”</blockquote>
              <p>
                {faculty.specialty} · Faculty availability:{" "}
                {faculty.officeHours.toLowerCase()}.
              </p>
            </section>
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
          <button onClick={compare}>COMPARE OTHER PATHWAYS</button>
          {isActive && program.registrationSummary.withdrawn ? (
            <button className={styles.primary} onClick={advising}>
              OPEN COURSE RE-ENTRY SUPPORT →
            </button>
          ) : isActive && program.registrationSummary.missing ? (
            <button className={styles.primary} onClick={enroll}>
              COMPLETE COURSE REGISTRATION →
            </button>
          ) : isActive ? (
            <button className={styles.primary} onClick={close}>
              PROGRAM ACTIVE
            </button>
          ) : !program.audit.eligible ? (
            <button disabled title={program.audit.blocker || undefined}>
              PRIOR PATHWAY REQUIRED
            </button>
          ) : (
            <button className={styles.primary} onClick={enroll}>
              REVIEW & CONFIRM PROGRAM →
            </button>
          )}
        </footer>
      </motion.article>
    </motion.div>
  );
}

function programLevelLabel(level: string) {
  if (level === "SHORT") return "Short credential";
  if (level === "ASSOCIATE") return "Associate pathway";
  if (level === "BACHELOR") return "Bachelor-level pathway";
  return level.replaceAll("_", " ");
}

function programLevelRank(level: string) {
  return level === "SHORT" ? 1 : level === "ASSOCIATE" ? 2 : 3;
}

function requirementCount(program: Program, type: string) {
  return program.requirements.filter((item) => item.type === type).length;
}

function programReason(program: Program, other: Program) {
  if (!program.audit.eligible) {
    return program.audit.blocker
      ? `Choose this pathway after resolving its prerequisite: ${program.audit.blocker}`
      : "Choose this pathway after completing its required prior academic level.";
  }
  if (program.audit.creditsApplied > other.audit.creditsApplied) {
    return `This pathway currently accepts ${program.audit.creditsApplied} of your completed credits, reducing repeated work and creating the more direct continuation from your record.`;
  }
  const levelDifference =
    programLevelRank(program.level) - programLevelRank(other.level);
  if (levelDifference < 0) {
    return `Choose this pathway for a faster, focused entry into ${program.academy} before committing to a broader multi-term program.`;
  }
  if (levelDifference > 0) {
    return `Choose this pathway for deeper ${program.academy} mastery, more advanced supporting study, and a larger culminating body of work.`;
  }
  if (program.academy !== other.academy) {
    return `Choose this pathway when your primary goal is ${program.academy}; its required courses and culminating experience keep that discipline at the center of the plan.`;
  }
  return `Choose this pathway when its intended audience and culminating experience match the work you want to produce: ${program.culminatingExperience}`;
}

function ProgramComparison({
  program,
  programs,
  close,
  openProgram,
}: {
  program: Program;
  programs: Program[];
  close: () => void;
  openProgram: (program: Program) => void;
}) {
  const choices = useMemo(
    () =>
      programs
        .filter((item) => item.id !== program.id)
        .sort((left, right) => {
          const academyDifference =
            Number(right.academy === program.academy) -
            Number(left.academy === program.academy);
          if (academyDifference) return academyDifference;
          const levelDifference =
            Math.abs(programLevelRank(left.level) - programLevelRank(program.level)) -
            Math.abs(programLevelRank(right.level) - programLevelRank(program.level));
          return levelDifference || left.title.localeCompare(right.title);
        }),
    [program, programs],
  );
  const [comparisonId, setComparisonId] = useState(choices[0]?.id || "");
  const comparison =
    choices.find((item) => item.id === comparisonId) || choices[0];

  if (!comparison) return null;

  const programCourseIds = new Set(
    program.requirements.map((item) => item.course.id),
  );
  const comparisonCourseIds = new Set(
    comparison.requirements.map((item) => item.course.id),
  );
  const sharedCourses = program.requirements.filter((item) =>
    comparisonCourseIds.has(item.course.id),
  ).length;
  const uniqueProgramCourses = program.requirements.filter(
    (item) => !comparisonCourseIds.has(item.course.id),
  );
  const uniqueComparisonCourses = comparison.requirements.filter(
    (item) => !programCourseIds.has(item.course.id),
  );
  const totalHours = (item: Program) =>
    item.requirements.reduce(
      (total, requirement) => total + requirement.course.workloadHours,
      0,
    );
  const facts = (item: Program) => [
    ["Pathway", programLevelLabel(item.level)],
    ["Required courses", String(item.requirements.length)],
    ["Learning credits", String(item.creditsRequired)],
    ["Planned terms", String(Math.ceil(item.durationDays / 120))],
    ["Documented workload", `${totalHours(item)} hours`],
    ["Your applied credit", `${item.audit.creditsApplied} credits`],
    ["Current entry status", item.audit.eligible ? "Eligible" : "Prerequisite required"],
    ["Sponsored value", money(item.estimatedValueCents)],
  ];

  return (
    <motion.div
      className={styles.comparisonBack}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <motion.section
        className={styles.comparisonDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="program-comparison-title"
        initial={{ y: 28, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.98 }}
      >
        <header className={styles.comparisonHeader}>
          <div>
            <small>ACADEMIC PATHWAY COMPARISON</small>
            <h2 id="program-comparison-title">See what truly changes.</h2>
            <p>
              Compare curriculum depth, time, transferred credit, outcomes,
              and the central reason to choose one pathway over another.
            </p>
          </div>
          <button type="button" onClick={close} aria-label="Close program comparison">
            ×
          </button>
        </header>

        <div className={styles.comparisonSelector}>
          <div>
            <small>YOUR STARTING PATHWAY</small>
            <b>{program.title}</b>
            <span>{program.code} · {program.academy}</span>
          </div>
          <label>
            COMPARE WITH
            <select
              value={comparison.id}
              onChange={(event) => setComparisonId(event.target.value)}
            >
              {choices.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} · {programLevelLabel(item.level)} · {item.academy}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.comparisonShared}>
          <span>{sharedCourses} SHARED COURSES</span>
          <i />
          <p>
            Shared courses transfer directly when completed. The differences
            below represent the additional academic direction each pathway
            provides.
          </p>
        </div>

        <div className={styles.comparisonColumns}>
          {[
            { item: program, other: comparison, unique: uniqueProgramCourses },
            { item: comparison, other: program, unique: uniqueComparisonCourses },
          ].map(({ item, other, unique }, columnIndex) => (
            <article key={item.id} className={styles.comparisonProgram}>
              <header>
                <small>{columnIndex === 0 ? "CURRENT SELECTION" : "COMPARISON PATHWAY"}</small>
                <span>{item.code}</span>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
              </header>

              <section className={styles.comparisonReason}>
                <small>CORE REASON TO CHOOSE THIS PATHWAY</small>
                <p>{programReason(item, other)}</p>
              </section>

              <dl className={styles.comparisonFacts}>
                {facts(item).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>

              <section className={styles.comparisonCurriculum}>
                <small>CURRICULUM COMPOSITION</small>
                <div>
                  {['CORE', 'SUPPORTING', 'ELECTIVE', 'CAPSTONE'].map((type) => (
                    <span key={type}>
                      <b>{requirementCount(item, type)}</b>
                      {type}
                    </span>
                  ))}
                </div>
              </section>

              <section className={styles.comparisonDistinct}>
                <small>DISTINCT REQUIRED STUDY</small>
                <h4>{unique.length} courses unique to this pathway</h4>
                <ul>
                  {unique.slice(0, 4).map((requirement) => (
                    <li key={requirement.id}>
                      <b>{requirement.course.title}</b>
                      <span>{requirement.course.academy} · {requirement.course.workloadHours} hours</span>
                    </li>
                  ))}
                  {!unique.length && <li>This pathway contains no additional unique courses.</li>}
                </ul>
              </section>

              <section className={styles.comparisonOutcome}>
                <small>WHO IT SERVES</small>
                <p>{item.audience}</p>
                <small>CULMINATING EXPERIENCE</small>
                <p>{item.culminatingExperience}</p>
              </section>
            </article>
          ))}
        </div>

        <footer className={styles.comparisonFooter}>
          <p>
            This comparison uses the live published curriculum and your current
            completed-credit audit.
          </p>
          <button type="button" onClick={close}>RETURN TO CURRENT PATHWAY</button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => openProgram(comparison)}
          >
            OPEN {comparison.code} →
          </button>
        </footer>
      </motion.section>
    </motion.div>
  );
}

type ProgramChangeQuote = {
  graceHours: number;
  elapsedHours: number;
  progressPercent: number;
  penaltyPercent: number;
  currentBalanceImpactCents: number;
  completedCreditsPreserved: boolean;
  explanation: string;
  coursePolicyNotice: string;
  retainedActiveCourses: { code: string; title: string }[];
  target: {
    code: string;
    title: string;
    newAllocationCents: number;
    newCourseCodes: string[];
  } | null;
};

function ProgramChangeModal({
  selection,
  close,
  confirmed,
}: {
  selection: ProgramChangeSelection;
  close: () => void;
  confirmed: () => Promise<void>;
}) {
  const activeEnrollment = selection.from.enrollments.find(
    (item) => item.status === "ACTIVE",
  );
  const [quote, setQuote] = useState<ProgramChangeQuote | null>(null);
  const [reason, setReason] = useState("");
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [courseAccepted, setCourseAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/university/programs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "quote_program_change",
        enrollmentId: activeEnrollment?.id,
        programId: selection.to.id,
      }),
    })
      .then(async (response) => ({ response, result: await response.json() }))
      .then(({ response, result }) => {
        if (!active) return;
        if (response.ok) setQuote(result.quote);
        else setMessage(result.error || "The program-change quote is unavailable.");
      })
      .catch(() => {
        if (active) setMessage("The program-change quote is unavailable. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [activeEnrollment?.id, selection.to.id]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeEnrollment || !quote || !policyAccepted || !courseAccepted) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/university/programs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "change_program",
          enrollmentId: activeEnrollment.id,
          programId: selection.to.id,
          reason,
          fundingAcknowledged: true,
          refundPolicyAcknowledged: true,
          programChangeAcknowledged: true,
        }),
      });
      const result = await response.json();
      if (!response.ok) setMessage(result.error || "The program change could not be completed.");
      else await confirmed();
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      className={styles.modalBack}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) close();
      }}
    >
      <motion.form
        className={`${styles.applicationModal} ${styles.programChangeModal}`}
        initial={{ scale: 0.96, y: 18 }}
        animate={{ scale: 1, y: 0 }}
        onSubmit={submit}
      >
        <button type="button" className={styles.modalClose} onClick={close} disabled={busy} aria-label="Close program change">
          Ã—
        </button>
        <small>PROGRAM CHANGE REVIEW</small>
        <h2>Move your academic pathway with a complete record.</h2>
        <div className={styles.programChangeRoute}>
          <span><small>CURRENT PROGRAM</small><b>{selection.from.title}</b><em>{selection.from.code}</em></span>
          <ArrowRight aria-hidden="true" />
          <span><small>NEW PROGRAM</small><b>{selection.to.title}</b><em>{selection.to.code}</em></span>
        </div>
        {!quote && !message && <p>Calculating the live 72-hour policy and curriculum impactâ€¦</p>}
        {quote && (
          <>
            <section className={styles.changeDecision} data-grace={quote.penaltyPercent === 0}>
              <div>
                <small>{quote.penaltyPercent === 0 ? "72-HOUR GRACE PERIOD" : "AFTER THE GRACE PERIOD"}</small>
                <h3>{quote.penaltyPercent === 0 ? "No program-change funding adjustment" : `${quote.penaltyPercent} point next-award adjustment`}</h3>
                <p>{quote.explanation}</p>
              </div>
              <dl>
                <div><dt>Program age</dt><dd>{quote.elapsedHours} hours</dd></div>
                <div><dt>Completed progress</dt><dd>{quote.progressPercent}%</dd></div>
                <div><dt>Balance change from switch</dt><dd>{money(quote.currentBalanceImpactCents)}</dd></div>
              </dl>
            </section>
            <section className={styles.changeCurriculum}>
              <h3>What changes when you confirm</h3>
              <ul>
                <li>Completed courses and earned credits remain on your record and apply wherever the new curriculum accepts them.</li>
                <li>{quote.coursePolicyNotice}</li>
                <li>{quote.target?.newCourseCodes.length ? `${quote.target.newCourseCodes.length} newly required courses will use ${money(quote.target.newAllocationCents)} of sponsored-learning value.` : "No new course allocation is required today; your existing and completed courses cover the immediate curriculum."}</li>
              </ul>
              {!!quote.retainedActiveCourses.length && (
                <p><b>Courses remaining active:</b> {quote.retainedActiveCourses.map((course) => course.code).join(", ")}. Withdraw them separately only if you no longer intend to complete them.</p>
              )}
            </section>
            <label className={styles.changeReason}>
              WHY ARE YOU CHANGING PROGRAMS?
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} required placeholder="Tell advising what changed in your goals, schedule, or academic direction." />
            </label>
            <label className={styles.confirmationCheck}>
              <input type="checkbox" checked={policyAccepted} onChange={(event) => setPolicyAccepted(event.target.checked)} />
              <span>I understand the quoted 72-hour program-change rule and any next-award adjustment shown above.</span>
            </label>
            <label className={styles.confirmationCheck}>
              <input type="checkbox" checked={courseAccepted} onChange={(event) => setCourseAccepted(event.target.checked)} />
              <span>I understand active courses are not automatically withdrawn and newly required courses may create normal noncash curriculum allocations. Student responsibility remains $0.00.</span>
            </label>
            <button className={styles.primary} disabled={busy || reason.trim().length < 10 || !policyAccepted || !courseAccepted}>
              {busy ? "CHANGING PROGRAMâ€¦" : "CONFIRM PROGRAM CHANGE â†’"}
            </button>
          </>
        )}
        {message && <em role="alert">{message}</em>}
      </motion.form>
    </motion.div>
  );
}

function EnrollmentConfirmationModal({
  confirmation,
  availableBalanceCents,
  close,
  confirmed,
}: {
  confirmation: EnrollmentConfirmation;
  availableBalanceCents: number;
  close: () => void;
  confirmed: () => Promise<void>;
}) {
  const [fundingAccepted, setFundingAccepted] = useState(false);
  const [refundAccepted, setRefundAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const isCourse = confirmation.kind === "COURSE";
  const title = isCourse
    ? confirmation.course.title
    : confirmation.program.title;
  const valueCents = isCourse
    ? confirmation.course.serviceValueCents
    : confirmation.program.registrationSummary.unregisteredValueCents;
  const continuityAwardCents = Math.max(
    0,
    valueCents - availableBalanceCents,
  );
  const projectedBalanceCents = Math.max(
    0,
    availableBalanceCents - valueCents,
  );

  return (
    <motion.div
      className={styles.modalBack}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) close();
      }}
    >
      <motion.form
        className={`${styles.applicationModal} ${styles.enrollmentConfirmation}`}
        initial={{ scale: 0.96, y: 18 }}
        animate={{ scale: 1, y: 0 }}
        onSubmit={async (event) => {
          event.preventDefault();
          if (!fundingAccepted || !refundAccepted) return;
          setSubmitting(true);
          setMessage("");
          const response = await fetch("/api/academy", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              action: isCourse ? "enroll_course" : "enroll_program",
              ...(isCourse
                ? { courseId: confirmation.course.id }
                : { programId: confirmation.program.id }),
              fundingAcknowledged: true,
              refundPolicyAcknowledged: true,
            }),
          });
          const result = await response.json();
          if (!response.ok) {
            setMessage(result.error || "Enrollment could not be completed.");
            setSubmitting(false);
          } else {
            await confirmed();
          }
        }}
      >
        <button
          type="button"
          className={styles.modalClose}
          onClick={close}
          disabled={submitting}
          aria-label="Close enrollment confirmation"
        >
          ×
        </button>
        <small>FINAL ENROLLMENT CONFIRMATION</small>
        <h2>{title}</h2>
        <p>
          {isCourse
            ? "This selection enrolls you immediately. Review the sponsored-learning allocation and withdrawal terms before confirming."
            : `This selection activates your academic pathway and immediately registers ${confirmation.program.registrationSummary.missing} eligible required course${confirmation.program.registrationSummary.missing === 1 ? "" : "s"}. Completed courses transfer automatically and are never charged twice.`}
        </p>
        <div className={styles.modalValue}>
          <span>{isCourse ? "COURSE ALLOCATION" : "CURRICULUM ALLOCATION TODAY"}</span>
          <b>{money(valueCents)}</b>
          <small>STUDENT RESPONSIBILITY · $0.00</small>
        </div>
        <dl className={styles.confirmationLedger}>
          <div>
            <dt>Available sponsored balance</dt>
            <dd>{money(availableBalanceCents)}</dd>
          </div>
          {continuityAwardCents > 0 && (
            <div>
              <dt>Automatic continuity award</dt>
              <dd>+{money(continuityAwardCents)}</dd>
            </div>
          )}
          <div>
            <dt>Balance after enrollment</dt>
            <dd>{money(projectedBalanceCents)}</dd>
          </div>
        </dl>
        {!isCourse && (
          <p className={styles.programAllocationNote}>
            One confirmation registers the program curriculum. The ledger will
            record one allocation for each newly registered required course;
            existing enrollments and completed transfer credit create no new
            charge. Coursework remains sequenced by its published prerequisites.
          </p>
        )}
        <section className={styles.fundingDisclosure}>
          <h3>What sponsored funding means</h3>
          <p>
            These are internal, noncash sponsored-learning credits used to
            measure and allocate university services. They are not tuition,
            payment, federal financial aid, a loan, cash, or student debt; they
            cannot be withdrawn or exchanged. Your responsibility remains
            $0.00.
          </p>
        </section>
        <section className={styles.refundDisclosure}>
          <h3>Withdrawal and restoration policy</h3>
          <p>
            A withdrawal within 24 hours restores 100% of the course allocation
            with no renewal penalty, unless final work was submitted. After 24
            hours, the lower of the time-based and progress-based return applies:
            up to 80% through 72 hours, 60% through day 7, 40% through day 14,
            20% after day 14, and 0% above 80% progress. Later withdrawals may
            also reduce a future renewal rate under the published policy.
          </p>
        </section>
        <label className={styles.confirmationCheck}>
          <input
            type="checkbox"
            checked={fundingAccepted}
            onChange={(event) => setFundingAccepted(event.target.checked)}
          />
          <span>
            I understand the sponsored-learning value is an internal noncash
            allocation and that {money(valueCents)} in eligible curriculum
            allocations will reduce my available sponsored balance.
          </span>
        </label>
        <label className={styles.confirmationCheck}>
          <input
            type="checkbox"
            checked={refundAccepted}
            onChange={(event) => setRefundAccepted(event.target.checked)}
          />
          <span>
            I understand that withdrawal restoration depends on elapsed time,
            course progress, and final-work status under the published policy.
          </span>
        </label>
        <button
          className={styles.primary}
          disabled={!fundingAccepted || !refundAccepted || submitting}
        >
          {submitting
            ? "CONFIRMING ENROLLMENT…"
            : isCourse
              ? "CONFIRM & ENROLL NOW →"
              : "CONFIRM & ACTIVATE PROGRAM →"}
        </button>
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
