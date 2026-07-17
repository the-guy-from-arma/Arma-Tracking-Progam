"use client";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import styles from "./PortalGateway.module.css";

const reveal = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
};
export function PortalGateway({
  user,
}: {
  user: { name: string; isStudent: boolean; role: string } | null;
}) {
  const universityReady = Boolean(
    user?.isStudent || ["OWNER", "ADMIN"].includes(user?.role || ""),
  );
  const universityHref =
    user?.role === "FACULTY"
      ? "/faculty"
      : universityReady
        ? "/university"
        : "/university/login";
  return (
    <main className={styles.gateway}>
      <div className={styles.aurora} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <header className={styles.header}>
        <div className={styles.network}>
          <b>V</b>
          <span>
            <strong>VALORIS NETWORK</strong>
            <small>DEVELOPMENT × ACADEMICS</small>
          </span>
        </div>
        {user ? (
          <div className={styles.welcome}>
            <span>WELCOME BACK</span>
            <b>{user.name}</b>
          </div>
        ) : (
          <Link href="/login">SIGN IN</Link>
        )}
      </header>
      <motion.section
        className={styles.intro}
        {...reveal}
        transition={{ duration: 0.55 }}
      >
        <p>SELECT YOUR WORKSPACE</p>
        <h1>
          One identity.
          <br />
          <em>Two focused environments.</em>
        </h1>
        <span>
          Enter the development network or continue through the complete
          Enfusion University campus.
        </span>
      </motion.section>
      <section
        className={styles.destinations}
        aria-label="Choose a destination"
      >
        <motion.div
          {...reveal}
          transition={{ delay: 0.1, duration: 0.6 }}
          whileHover={{ y: -5 }}
        >
          <Link
            href={user ? "/valoris" : "/login"}
            className={`${styles.portal} ${styles.valoris}`}
          >
            <div className={styles.visual} aria-hidden="true">
              <b>V</b>
              <i />
              <i />
            </div>
            <header>
              <span>01</span>
              <small>DEVELOPMENT NETWORK</small>
            </header>
            <div className={styles.copy}>
              <small>PROJECT</small>
              <h2>VALORIS</h2>
              <p>
                Objectives, decisions, milestones, blockers, and technical
                knowledge in one professional development record.
              </p>
            </div>
            <footer>
              <span>WORKSTREAMS · OBJECTIVES · KNOWLEDGE</span>
              <b>ENTER ↗</b>
            </footer>
          </Link>
        </motion.div>
        <motion.div
          {...reveal}
          transition={{ delay: 0.18, duration: 0.6 }}
          whileHover={{ y: -5 }}
        >
          <Link
            href={universityHref}
            className={`${styles.portal} ${styles.university}`}
          >
            <div className={styles.universityIdentity}>
              <Image
                src="/enfusion-university-lockup.png"
                alt="Enfusion University"
                width={1600}
                height={388}
                priority
              />
            </div>
            <header>
              <span>02</span>
              <small>ACADEMIC CAMPUS</small>
            </header>
            <div className={styles.copy}>
              <small>CREATE · BUILD · INNOVATE</small>
              <h2>Continue learning</h2>
              <p>
                Source-grounded Workbench coursework, sponsored learning,
                intelligent assessment, and durable academic records.
              </p>
            </div>
            <footer>
              <span>192 COURSES · 144 PROGRAMS · 16 ACADEMIES</span>
              <b>ENTER ↗</b>
            </footer>
          </Link>
        </motion.div>
      </section>
      <footer className={styles.footer}>
        <span>THUNDER BUDDIES STUDIOS × BLACK RIDGE STUDIOS</span>
        <small>Independent, non-accredited online learning institution.</small>
        <Link href={user?.role === "OWNER" ? "/owner" : "/owner/login"}>
          OWNER ACCESS
        </Link>
      </footer>
    </main>
  );
}
