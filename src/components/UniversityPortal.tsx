"use client";

import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UniversityLearning } from "@/components/UniversityLearning";
import { AcademicBoot } from "@/components/AcademicBoot";
import { universityFacultyLinks } from "@/lib/ai-faculty";
import { AccountAlerts } from "@/components/AccountAlerts";
import styles from "./UniversityPortal.module.css";

export type UniversityView =
  | "dashboard"
  | "student-center"
  | "profile"
  | "programs"
  | "catalog"
  | "learning"
  | "funding"
  | "notifications"
  | "credentials"
  | "submissions"
  | "messages"
  | "faculty"
  | "policies";
const studentViews: { id: UniversityView; label: string; short: string }[] = [
  { id: "dashboard", label: "Campus Home", short: "Home" },
  { id: "learning", label: "My Courses", short: "Courses" },
  { id: "programs", label: "Programs", short: "Programs" },
  { id: "catalog", label: "Discover", short: "Discover" },
  { id: "student-center", label: "Student Center", short: "Center" },
  { id: "messages", label: "Campus Messages", short: "Messages" },
  { id: "faculty", label: "Faculty Commons", short: "Faculty" },
  { id: "policies", label: "Policies & Agreements", short: "Policies" },
  { id: "funding", label: "Funding", short: "Funding" },
  { id: "submissions", label: "Assignments & Grades", short: "Grades" },
  { id: "notifications", label: "Campus Weekly", short: "Weekly" },
  { id: "credentials", label: "Credentials", short: "Awards" },
  { id: "profile", label: "Student Profile", short: "Profile" },
];
const footerFacultyLinks = universityFacultyLinks.filter((faculty) =>
  [
    "elara-voss",
    "marisol-grant",
    "theodore-wells",
    "dana-mercer",
    "avery-bell",
  ].includes(faculty.slug),
);

type PortalUser = {
  name: string;
  role: string;
  academicEmail: string | null;
  studentNumber: string | null;
};

type PolicyAlert = {
  bundleStatus: string;
  policyCompliant: boolean;
  missingPolicyVersions: { slug: string; title: string; version: number }[];
};

type OperationalAlert = {
  admissionsMode: "OPEN" | "PAUSED";
  enrollmentMode: "OPEN" | "PAUSED";
  learningMode: "ACTIVE" | "ACADEMIC_BREAK" | "MAINTENANCE" | "EMERGENCY_CLOSURE";
  publicTitle: string;
  publicMessage: string;
  reopensAt: string | null;
  season: string;
  campusBannerEnabled: boolean;
  campusBannerTitle: string;
  campusBannerMessage: string;
  campusBannerTone: string;
  hiddenNavigationViews: string[];
  courseSelectionEnabled: boolean;
  programSelectionEnabled: boolean;
  experienceUpdatedAt: string;
};

export function UniversityPortal({ user }: { user: PortalUser }) {
  const [view, setView] = useState<UniversityView>(() => {
    if (typeof window === "undefined") return "dashboard";
    const requested = new URLSearchParams(window.location.search).get(
      "view",
    ) as UniversityView | null;
    return requested && studentViews.some((item) => item.id === requested)
      ? requested
      : "dashboard";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [facultySlug, setFacultySlug] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [policyAlert, setPolicyAlert] = useState<PolicyAlert | null>(null);
  const [policyNoticeOpen, setPolicyNoticeOpen] = useState(false);
  const [operations, setOperations] = useState<OperationalAlert | null>(null);
  const [selectionNoticeOpen, setSelectionNoticeOpen] = useState(false);
  useEffect(() => {
    const initialize = setTimeout(() => {
      const saved = localStorage.getItem("efu:theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    }, 0);
    return () => clearTimeout(initialize);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetch("/api/campus/status", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error("Campus status unavailable");
          return response.json();
        })
        .then((result: OperationalAlert) => {
          setOperations(result);
          const hidden = Array.isArray(result.hiddenNavigationViews) ? result.hiddenNavigationViews : [];
          setView((current) => {
            if (!hidden.includes(current)) return current;
            window.history.replaceState(null, "", "/university?view=dashboard");
            return "dashboard";
          });
          if (result.courseSelectionEnabled && result.programSelectionEnabled) return;
          const noticeKey = `enscript:selection-notice:${result.experienceUpdatedAt}`;
          if (sessionStorage.getItem(noticeKey)) return;
          sessionStorage.setItem(noticeKey, "shown");
          setSelectionNoticeOpen(true);
        })
        .catch(() => undefined);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetch("/api/university/policies", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error("Policy status unavailable");
          return (await response.json()) as PolicyAlert;
        })
        .then((result) => {
          setPolicyAlert(result);
          if (result.bundleStatus !== "ACTION_REQUIRED") return;
          const noticeKey = `efu:policy-change:${result.missingPolicyVersions
            .map((item) => `${item.slug}:${item.version}`)
            .sort()
            .join("|")}`;
          if (sessionStorage.getItem(noticeKey)) return;
          sessionStorage.setItem(noticeKey, "shown");
          setPolicyNoticeOpen(true);
        })
        .catch(() => undefined);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  const router = useRouter();
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  const hiddenViews = new Set(
    Array.isArray(operations?.hiddenNavigationViews)
      ? operations.hiddenNavigationViews
      : [],
  );
  const visibleStudentViews = studentViews.filter(
    (item) => item.id === "dashboard" || !hiddenViews.has(item.id),
  );
  function choose(next: UniversityView) {
    if (hiddenViews.has(next)) {
      setView("dashboard");
      setMobileOpen(false);
      window.history.replaceState(null, "", "/university?view=dashboard");
      return;
    }
    setView(next);
    setFacultySlug(null);
    setMobileOpen(false);
    window.history.replaceState(null, "", `/university?view=${next}`);
  }
  function openFaculty(slug: string) {
    setFacultySlug(slug);
    setView("messages");
    setMobileOpen(false);
    window.history.replaceState(
      null,
      "",
      `/university?view=messages&faculty=${encodeURIComponent(slug)}`,
    );
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  function toggleTheme() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem("efu:theme", next);
      return next;
    });
  }
  function selectionUnavailable() {
    setSelectionNoticeOpen(true);
  }

  return (
    <main className={styles.campus} data-university-theme={theme}>
      <AcademicBoot />
      <header className={styles.utilityHeader}>
        <div className={styles.utilityInner}>
          <Link href="/" className={styles.brand}>
            <Image
              className={styles.universityLogo}
              src={
                theme === "dark"
                  ? "/enscript-university-lockup.png"
                  : "/enscript-university-lockup-light.png"
              }
              alt="Enscript University — Create, Build, Innovate"
              width={1983}
              height={793}
              priority
            />
          </Link>
          {!hiddenViews.has("learning") && (
            <button
              className={styles.courseSelector}
              onClick={() => choose("learning")}
            >
              <span>MY COURSES</span>
              <b>
                {view === "learning" ? "Active learning" : "Open your courses"}
              </b>
              <i>⌄</i>
            </button>
          )}
          <nav className={styles.utilities} aria-label="Student utilities">
            <button
              className={styles.themeToggle}
              onClick={toggleTheme}
              aria-label={`Use ${theme === "dark" ? "light" : "dark"} university theme`}
            >
              <i>{theme === "dark" ? "☀" : "◐"}</i>
              <span>{theme === "dark" ? "Light" : "Dark"}</span>
            </button>
            {!hiddenViews.has("student-center") && (
              <button
                onClick={() => choose("student-center")}
                aria-label="Student center"
              >
                <i>?</i>
                <span>Help</span>
              </button>
            )}
            <AccountAlerts weeklyAvailable={!hiddenViews.has("notifications")} />
            {!hiddenViews.has("submissions") && (
              <button
                onClick={() => choose("submissions")}
                aria-label="Assignments and grades"
              >
                <i>✓</i>
                <span>Grades</span>
              </button>
            )}
            {!hiddenViews.has("profile") && (
              <button
                className={styles.profileButton}
                onClick={() => choose("profile")}
              >
                <i>{initials}</i>
                <span>
                  <b>{user.name}</b>
                  <small>{user.studentNumber || "STUDENT PROFILE"}</small>
                </span>
              </button>
            )}
          </nav>
          <button
            className={styles.menuButton}
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-label="Open campus navigation"
          >
            MENU
          </button>
        </div>
      </header>
      <nav
        className={`${styles.primaryNav} ${mobileOpen ? styles.open : ""}`}
        aria-label="University navigation"
      >
        <div>
          {visibleStudentViews.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? styles.active : ""}
              onClick={() => choose(item.id)}
            >
              <span>{item.label}</span>
              <small>{item.short}</small>
            </button>
          ))}
          <button className={styles.signOut} onClick={logout}>
            SIGN OUT
          </button>
        </div>
      </nav>
      {operations && (operations.learningMode !== "ACTIVE" || operations.admissionsMode !== "OPEN" || operations.enrollmentMode !== "OPEN") && (
        <div className={styles.operationsBanner} data-season={operations.season} role="status">
          <span><b>{operations.publicTitle}</b> {operations.publicMessage}</span>
          {operations.reopensAt && <time dateTime={operations.reopensAt}>REOPENS {new Date(operations.reopensAt).toLocaleString()}</time>}
        </div>
      )}
      {view === "dashboard" && operations?.campusBannerEnabled && (
        <motion.section
          className={styles.campusAnnouncement}
          data-tone={operations.campusBannerTone}
          role="status"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span>ENSCRIPT UNIVERSITY · CAMPUS ANNOUNCEMENT</span>
          <div><b>{operations.campusBannerTitle}</b><p>{operations.campusBannerMessage}</p></div>
          {!hiddenViews.has("notifications") && (
            <button onClick={() => choose("notifications")}>READ CAMPUS WEEKLY →</button>
          )}
        </motion.section>
      )}
      {view === "dashboard" &&
        policyAlert?.bundleStatus === "ACTION_REQUIRED" && (
          <div className={styles.policyBanner} role="status">
            <span>
              <b>Policies have changed.</b> Review and sign{" "}
              {policyAlert.missingPolicyVersions.length} updated{" "}
              {policyAlert.missingPolicyVersions.length === 1
                ? "document"
                : "documents"}{" "}
              to continue university services.
            </span>
            <Link href="/policies/accept">REVIEW CHANGES →</Link>
          </div>
        )}
      <div className={styles.contextBar}>
        <div>
          <span>ENSCRIPT UNIVERSITY</span>
          <i>/</i>
          <b>{studentViews.find((item) => item.id === view)?.label}</b>
        </div>
        <span className={styles.online}>
          <i data-mode={operations?.learningMode || "ACTIVE"} /> {operations?.learningMode === "ACTIVE" ? "CAMPUS ONLINE" : (operations?.learningMode || "CAMPUS ONLINE").replaceAll("_", " ")}
        </span>
      </div>
      <section className={styles.surface}>
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            className={styles.viewport}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            <UniversityLearning
              view={view}
              userName={user.name}
              onNavigate={choose}
              facultySlug={facultySlug}
              onOpenFaculty={openFaculty}
              courseSelectionEnabled={operations?.courseSelectionEnabled !== false}
              programSelectionEnabled={operations?.programSelectionEnabled !== false}
              onSelectionUnavailable={selectionUnavailable}
            />
          </motion.div>
        </AnimatePresence>
      </section>
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
          <Image
            src={
              theme === "dark"
                ? "/enscript-university-lockup.png"
                : "/enscript-university-lockup-light.png"
            }
            alt="Enscript University — Create, Build, Innovate"
            width={1983}
            height={793}
          />
        </div>
        <nav>
          {!hiddenViews.has("student-center") && <button onClick={() => choose("student-center")}>Student Services</button>}
          {!hiddenViews.has("funding") && <button onClick={() => choose("funding")}>Funding Center</button>}
          {!hiddenViews.has("profile") && <button onClick={() => choose("profile")}>Academic Record</button>}
          {!hiddenViews.has("policies") && <button onClick={() => choose("policies")}>Policies & Agreements</button>}
        </nav>
        <small>
          Independent online learning institution · Student responsibility $0.00
        </small>
        {!hiddenViews.has("faculty") && <section className={styles.footerFaculty} aria-labelledby="footer-faculty-heading">
          <header>
            <span>FACULTY COMMONS</span>
            <h2 id="footer-faculty-heading">Faculty and university offices</h2>
            <p>Leadership contacts are always one message away.</p>
          </header>
          <div>
            {footerFacultyLinks.map((faculty) => (
              <button key={faculty.slug} onClick={() => openFaculty(faculty.slug)}>
                <b>{faculty.name}</b>
                <span>{faculty.office}</span>
              </button>
            ))}
            <button className={styles.allFacultyLink} onClick={() => choose("faculty")}>
              <b>Complete faculty directory</b>
              <span>Faculty Commons →</span>
            </button>
          </div>
        </section>}
      </footer>
      {selectionNoticeOpen && operations && (
        <div className={styles.selectionNoticeBack} role="presentation">
          <motion.section
            className={styles.selectionNotice}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="selection-notice-title"
            initial={{ opacity: 0, scale: .96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
          >
            <button className={styles.policyNoticeClose} aria-label="Close selection notice" onClick={() => setSelectionNoticeOpen(false)}>×</button>
            <span>WELCOME TO ENSCRIPT UNIVERSITY</span>
            <h2 id="selection-notice-title">Your campus account is ready.</h2>
            <p>
              {!operations.courseSelectionEnabled && !operations.programSelectionEnabled
                ? "Course and program selection is not open yet."
                : !operations.courseSelectionEnabled
                  ? "Course selection is not open yet."
                  : "Program selection is not open yet."} Please return soon to choose your next academic experience. Your student profile, records, messages, policies, and available campus services remain protected.
            </p>
            <div>
              <button onClick={() => setSelectionNoticeOpen(false)}>CONTINUE TO CAMPUS HOME</button>
              {!hiddenViews.has("notifications") && <button onClick={() => { setSelectionNoticeOpen(false); choose("notifications"); }}>READ CAMPUS WEEKLY →</button>}
            </div>
          </motion.section>
        </div>
      )}
      {policyNoticeOpen && policyAlert && (
        <div className={styles.policyNoticeBack} role="presentation">
          <section
            className={styles.policyNotice}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="policy-change-title"
          >
            <button
              className={styles.policyNoticeClose}
              aria-label="Close policy change notice"
              onClick={() => setPolicyNoticeOpen(false)}
            >
              ×
            </button>
            <span>UNIVERSITY RECORDS · ACTION REQUIRED</span>
            <h2 id="policy-change-title">University policies have changed.</h2>
            <p>
              A material policy update has been published. Review the exact new
              versions before resuming coursework, enrollment, faculty
              messaging, submissions, or credentials.
            </p>
            <ul>
              {policyAlert.missingPolicyVersions.map((item) => (
                <li key={`${item.slug}-${item.version}`}>
                  <b>{item.title}</b>
                  <span>Version {item.version}</span>
                </li>
              ))}
            </ul>
            <div>
              <button onClick={() => setPolicyNoticeOpen(false)}>
                REMIND ME ON CAMPUS HOME
              </button>
              <Link href="/policies/accept">REVIEW AND SIGN NOW →</Link>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
