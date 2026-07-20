"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import styles from "./UniversitySignIn.module.css";

type CampusTheme = "dark" | "light";

export function UniversitySignIn() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [theme, setTheme] = useState<CampusTheme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem("efu:theme");
    if (stored !== "dark" && stored !== "light") return;
    const update = window.setTimeout(() => setTheme(stored), 0);
    return () => window.clearTimeout(update);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("efu:theme", next);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Unable to sign in to the student portal.");
      setBusy(false);
      return;
    }
    router.push(result.policyGateUrl || "/university");
    router.refresh();
  }

  const duration = reduceMotion ? 0 : 0.72;

  return (
    <main className={styles.page} data-theme={theme}>
      <div className={styles.atmosphere} aria-hidden="true">
        <span className={styles.orbitOne} />
        <span className={styles.orbitTwo} />
        <span className={styles.signal} />
      </div>

      <header className={styles.utility}>
        <Link href="/" className={styles.gatewayLink}>
          <span aria-hidden="true">←</span> Portal gateway
        </Link>
        <div className={styles.utilityActions}>
          <span className={styles.status}>
            <i aria-hidden="true" /> Campus online
          </span>
          <button className={styles.themeToggle} type="button" onClick={toggleTheme}>
            <span aria-hidden="true">{theme === "dark" ? "☀" : "◐"}</span>
            {theme === "dark" ? "Light campus" : "Dark campus"}
          </button>
        </div>
      </header>

      <section className={styles.shell} aria-labelledby="signin-title">
        <motion.div
          className={styles.identity}
          initial={reduceMotion ? false : { opacity: 0, x: -32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className={styles.logoStage}>
            <motion.div
              className={styles.logoReveal}
              initial={reduceMotion ? false : { clipPath: "inset(0 100% 0 0)" }}
              animate={{ clipPath: "inset(0 0% 0 0)" }}
              transition={{ duration: reduceMotion ? 0 : 1.15, delay: 0.12, ease: [0.76, 0, 0.24, 1] }}
            >
              <Image
                src={theme === "dark" ? "/enscript-university-lockup.png" : "/enscript-university-lockup-light.png"}
                alt="Enscript University — Create, Build, Innovate"
                width={1983}
                height={793}
                priority
              />
            </motion.div>
            <motion.span
              className={styles.logoScan}
              aria-hidden="true"
              initial={reduceMotion ? false : { left: "0%", opacity: 0 }}
              animate={reduceMotion ? { opacity: 0 } : { left: "104%", opacity: [0, 1, 0] }}
              transition={{ duration: 1.25, delay: 0.25, ease: "easeInOut" }}
            />
          </div>

          <div className={styles.identityCopy}>
            <p className={styles.eyebrow}>Student information system · Secure campus access</p>
            <h1>
              Your work has a place.
              <em>Your progress has a record.</em>
            </h1>
            <p className={styles.lede}>
              Return to your coursework, faculty feedback, sponsored-learning account,
              and the development pathway you are building day by day.
            </p>
          </div>

          <div className={styles.campusSignals} aria-label="Campus services">
            <span><b>01</b> Structured learning</span>
            <span><b>02</b> Studio assessment</span>
            <span><b>03</b> Durable credentials</span>
          </div>
        </motion.div>

        <motion.section
          className={styles.accessPanel}
          initial={reduceMotion ? false : { opacity: 0, y: 26, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration, delay: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className={styles.panelTopline} aria-hidden="true"><span /></div>
          <header className={styles.panelHeader}>
            <span className={styles.accessMark}>ES · ACCESS 01</span>
            <p>Enscript University</p>
            <h2 id="signin-title">Welcome back.</h2>
            <p>Sign in with your internal ESU ID or the recovery email attached to your student profile.</p>
          </header>

          <form className={styles.form} onSubmit={submit}>
            <label>
              <span>ESU ID or recovery email</span>
              <input
                name="email"
                required
                type="email"
                autoComplete="email"
                placeholder="alex.morgan@enscriptuniversity.edu"
              />
            </label>
            <label>
              <span>Password</span>
              <div className={styles.passwordField}>
                <input
                  name="password"
                  required
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            {error && <p className={styles.error} role="alert">{error}</p>}

            <button className={styles.submit} type="submit" disabled={busy}>
              <span>{busy ? "Opening your campus…" : "Enter student campus"}</span>
              <b aria-hidden="true">→</b>
            </button>
          </form>

          <div className={styles.admissions}>
            <p>Beginning your academic path?</p>
            <Link href="/university/register">Start an admissions application <span aria-hidden="true">↗</span></Link>
          </div>

          <p className={styles.disclosure}>
            Your @enscriptuniversity.edu identifier is a secure internal campus login,
            not an internet email mailbox.
          </p>
        </motion.section>
      </section>

      <footer className={styles.footer}>
        <span>Thunder Buddies Studios × Black Ridge Studios</span>
        <span>Enscript University · Create · Build · Innovate · <Link href="/policies">Policies</Link></span>
      </footer>
    </main>
  );
}
