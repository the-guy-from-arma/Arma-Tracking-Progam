"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import styles from "./PortalGateway.module.css";

export function PortalGateway({
  user,
  operations,
}: {
  user: { name: string; isStudent: boolean; role: string } | null;
  operations: {
    admissionsMode: string;
    enrollmentMode: string;
    learningMode: string;
    publicTitle: string;
    publicMessage: string;
    reopensAt: string | null;
  };
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [entering, setEntering] = useState(false);
  const universityReady = Boolean(
    user?.isStudent || ["OWNER", "ADMIN"].includes(user?.role || ""),
  );
  const campusHref =
    user?.role === "FACULTY"
      ? "/faculty"
      : universityReady
        ? "/university"
        : "/university/login";

  function enterCampus(event: React.MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (reduceMotion) {
      router.push(campusHref);
      return;
    }
    setEntering(true);
    window.setTimeout(() => router.push(campusHref), 640);
  }

  return (
    <main className={styles.gateway}>
      <div className={styles.atmosphere} aria-hidden="true">
        <span />
        <span />
        <span />
        <i />
      </div>

      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Enscript University home">
          <Image
            src="/enscript-university-lockup.png"
            alt="Enscript University — Create, Build, Innovate"
            width={1983}
            height={793}
            priority
          />
        </Link>
        <div className={styles.account}>
          {user ? (
            <>
              <span>Welcome back</span>
              <strong>{user.name}</strong>
            </>
          ) : (
            <Link href="/university/login">Student sign in</Link>
          )}
        </div>
      </header>

      {(operations.admissionsMode !== "OPEN" ||
        operations.enrollmentMode !== "OPEN" ||
        operations.learningMode !== "ACTIVE") && (
        <Link className={styles.statusBanner} href="/campus-status">
          <strong>{operations.publicTitle}</strong>
          <span>{operations.publicMessage}</span>
          {operations.reopensAt && (
            <time dateTime={operations.reopensAt}>
              Reopens {new Date(operations.reopensAt).toLocaleString()}
            </time>
          )}
          <b aria-hidden="true">View status →</b>
        </Link>
      )}

      <section className={styles.hero} aria-labelledby="university-gateway-title">
        <motion.div
          className={styles.copy}
          initial={reduceMotion ? false : { opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.75, ease: [0.22, 1, 0.36, 1] }}
        >
          <p>Online technical university · Enfusion Workbench development</p>
          <h1 id="university-gateway-title">
            Learn the system.
            <em>Build the future.</em>
          </h1>
          <span>
            Structured Enfusion Workbench education, studio-reviewed practice,
            sponsored learning, intelligent assessment, and a permanent academic record.
          </span>
          <div className={styles.actions}>
            <Link className={styles.primary} href={campusHref} onClick={enterCampus}>
              {universityReady || user?.role === "FACULTY" ? "Enter your campus" : "Student sign in"}
              <b aria-hidden="true">→</b>
            </Link>
            {!universityReady && user?.role !== "FACULTY" && (
              <Link className={styles.secondary} href="/university/register">
                Begin admissions <span aria-hidden="true">↗</span>
              </Link>
            )}
          </div>
          <dl className={styles.facts}>
            <div><dt>192</dt><dd>Technical courses</dd></div>
            <div><dt>144</dt><dd>Academic programs</dd></div>
            <div><dt>16</dt><dd>Specialist academies</dd></div>
            <div><dt>$0</dt><dd>Student responsibility</dd></div>
          </dl>
        </motion.div>

        <motion.div
          className={styles.identityField}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.93 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : 1, delay: reduceMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden="true"
        >
          <div className={styles.rings}><i /><i /><i /></div>
          <div className={styles.emblem}>
            <span className={styles.emblemHalo} />
            <span className={styles.emblemCrop}>
              <Image
                src="/enscript-university-lockup.png"
                alt=""
                width={1983}
                height={793}
                priority
              />
            </span>
            <span className={styles.emblemSweep} />
          </div>
          <span className={styles.signalOne} />
          <span className={styles.signalTwo} />
          <p>CREATE · BUILD · INNOVATE</p>
        </motion.div>
      </section>

      <footer className={styles.footer}>
        <span>Thunder Buddies Studios × Black Ridge Studios</span>
        <div>
          <small>Independent online learning institution</small>
          <Link href="/policies">Policy Center</Link>
          <Link href={user?.role === "OWNER" ? "/owner" : "/owner/login"}>Owner access</Link>
        </div>
      </footer>

      <AnimatePresence>
        {entering && (
          <motion.div
            className={styles.campusTransition}
            initial={{ clipPath: "circle(0% at 50% 50%)" }}
            animate={{ clipPath: "circle(145% at 50% 50%)" }}
            transition={{ duration: 0.64, ease: [0.76, 0, 0.24, 1] }}
            role="status"
            aria-live="polite"
          >
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}>
              <Image
                src="/enscript-university-lockup.png"
                alt="Opening Enscript University"
                width={1983}
                height={793}
              />
              <span>Preparing your campus</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
