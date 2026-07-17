"use client";

import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
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
  | "submissions";
const studentViews: { id: UniversityView; label: string; short: string }[] = [
  { id: "dashboard", label: "Campus Home", short: "Home" },
  { id: "learning", label: "My Courses", short: "Courses" },
  { id: "programs", label: "Programs", short: "Programs" },
  { id: "catalog", label: "Discover", short: "Discover" },
  { id: "student-center", label: "Student Center", short: "Center" },
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

  return (
    <main className={styles.campus}>
      <AcademicBoot />
      <header className={styles.utilityHeader}>
        <div className={styles.utilityInner}>
          <Link href="/" className={styles.brand}>
            <span className={styles.brandMark}>
              <Image
                src="/enfusion-university-logo.png"
                alt=""
                width={1536}
                height={1024}
                priority
              />
            </span>
            <span>
              <strong>Enfusion University</strong>
              <small>Thunder Buddies Studios × Black Ridge Studios</small>
            </span>
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
          <Link href="/valoris">PROJECT VALORIS ↗</Link>
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
            src="/enfusion-university-logo.png"
            alt="Enfusion University — Create, Build, Innovate"
            width={1536}
            height={1024}
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
