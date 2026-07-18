import Image from "next/image";
import Link from "next/link";
import styles from "./AcademicLoader.module.css";

export function AcademicLoader({
  label = "Opening your campus",
  error = false,
}: {
  label?: string;
  error?: boolean;
}) {
  const authenticationError = /authentication required/i.test(label);

  return (
    <section
      className={styles.loader}
      data-state={error ? "error" : "loading"}
      role={error ? "alert" : "status"}
      aria-live="polite"
      aria-busy={!error}
    >
      <div className={styles.atmosphere} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className={styles.identity}>
        <div className={styles.logoReveal}>
          <Image
            src="/enfusion-university-lockup.png"
            alt="Enfusion University — Create, Build, Innovate"
            width={1600}
            height={388}
            priority
          />
        </div>
        <div className={styles.rule} aria-hidden="true">
          <i />
        </div>
        <p>{error ? "CAMPUS ACCESS NOTICE" : "SECURE ACADEMIC ENVIRONMENT"}</p>
        <h2>{label}</h2>
        {!error && (
          <div className={styles.progress} aria-hidden="true">
            <span />
          </div>
        )}
        {authenticationError && (
          <Link href="/university/login">Return to student sign in →</Link>
        )}
        <small>THUNDER BUDDIES STUDIOS × BLACK RIDGE STUDIOS</small>
      </div>
    </section>
  );
}
