"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "./AcademicBoot.module.css";
export function AcademicBoot({
  label = "ENFUSION UNIVERSITY",
}: {
  label?: string;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem("efu:institutional-boot") === "1") return;
    sessionStorage.setItem("efu:institutional-boot", "1");
    const reveal = setTimeout(() => setVisible(true), 0);
    const hide = setTimeout(
      () => setVisible(false),
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 250 : 1750,
    );
    return () => {
      clearTimeout(reveal);
      clearTimeout(hide);
    };
  }, []);
  if (!visible) return null;
  return (
    <div className={styles.boot} role="status" aria-live="polite">
      <div className={styles.logo}>
        <Image
          src="/enfusion-university-lockup.png"
          alt="Enfusion University"
          width={1600}
          height={388}
          priority
        />
      </div>
      <section>
        <small>THUNDER BUDDIES STUDIOS × BLACK RIDGE STUDIOS</small>
        <h1>{label}</h1>
        <p>
          Preparing the institutional record, current coursework, and secure
          academic services.
        </p>
        <span>
          <i />
        </span>
      </section>
    </div>
  );
}
