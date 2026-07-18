"use client";

import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UniversityLearning } from "@/components/UniversityLearning";
import { AcademicBoot } from "@/components/AcademicBoot";
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
  | "messages";
const studentViews: { id: UniversityView; label: string; short: string }[] = [
  { id: "dashboard", label: "Campus Home", short: "Home" },
  { id: "learning", label: "My Courses", short: "Courses" },
  { id: "programs", label: "Programs", short: "Programs" },
  { id: "catalog", label: "Discover", short: "Discover" },
  { id: "student-center", label: "Student Center", short: "Center" },
  { id: "messages", label: "Campus Messages", short: "Messages" },
  { id: "funding", label: "Funding", short: "Funding" },
  { id: "submissions", label: "Assignments & Grades", short: "Grades" },
  { id: "notifications", label: "Announcements", short: "News" },
  { id: "credentials", label: "Credentials", short: "Awards" },
  { id: "profile", label: "Student Profile", short: "Profile" },
];

type PortalUser = {
  name: string;
  role: string;
  academicEmail: string | null;
  studentNumber: string | null;
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
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const initialize = setTimeout(() => {
      const saved = localStorage.getItem("efu:theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    }, 0);
    return () => clearTimeout(initialize);
  }, []);
  const router = useRouter();
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  function choose(next: UniversityView) {
    setView(next);
    setMobileOpen(false);
    window.history.replaceState(null, "", `/university?view=${next}`);
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
                  ? "/enfusion-university-lockup.png"
                  : "/enfusion-university-lockup-light.png"
              }
              alt="Enfusion University — Create, Build, Innovate"
              width={1600}
              height={388}
              priority
            />
          </Link>
          <button
            className={styles.courseSelector}
            onClick={() => choose("learning")}
          >
            <span>MY COURSES</span>
            <b>
              {view === "learning" ? "Active learning" : "Open course selector"}
            </b>
            <i>⌄</i>
          </button>
          <nav className={styles.utilities} aria-label="Student utilities">
            <button
              className={styles.themeToggle}
              onClick={toggleTheme}
              aria-label={`Use ${theme === "dark" ? "light" : "dark"} university theme`}
            >
              <i>{theme === "dark" ? "☀" : "◐"}</i>
              <span>{theme === "dark" ? "Light" : "Dark"}</span>
            </button>
            <button
              onClick={() => choose("student-center")}
              aria-label="Student center"
            >
              <i>?</i>
              <span>Help</span>
            </button>
            <button
              onClick={() => choose("notifications")}
              aria-label="Announcements"
            >
              <i>◌</i>
              <span>Alerts</span>
              <em />
            </button>
            <button
              onClick={() => choose("submissions")}
              aria-label="Assignments and grades"
            >
              <i>✓</i>
              <span>Grades</span>
            </button>
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
          {studentViews.map((item) => (
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
      <div className={styles.contextBar}>
        <div>
          <span>ENFUSION UNIVERSITY</span>
          <i>/</i>
          <b>{studentViews.find((item) => item.id === view)?.label}</b>
        </div>
        <span className={styles.online}>
          <i /> CAMPUS ONLINE
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
            />
          </motion.div>
        </AnimatePresence>
      </section>
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
          <Image
            src={
              theme === "dark"
                ? "/enfusion-university-lockup.png"
                : "/enfusion-university-lockup-light.png"
            }
            alt="Enfusion University — Create, Build, Innovate"
            width={1600}
            height={388}
          />
        </div>
        <nav>
          <button onClick={() => choose("student-center")}>
            Student Services
          </button>
          <button onClick={() => choose("funding")}>Funding Center</button>
          <button onClick={() => choose("profile")}>Academic Record</button>
        </nav>
        <small>
          Independent online learning institution · Student responsibility $0.00
        </small>
      </footer>
    </main>
  );
}
