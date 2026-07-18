"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Academy } from "@/components/Academy";
import { AcademicBoot } from "@/components/AcademicBoot";
import { GuideAcademy } from "@/components/GuideAcademy";
import styles from "./FacultyConsole.module.css";
export function FacultyConsole({ name }: { name: string }) {
  const [view, setView] = useState<"teaching" | "academy">("teaching");
  return (
    <main className={styles.console}>
      <AcademicBoot label="FACULTY ACADEMY" />
      <header>
        <Link href="/" className={styles.brand}>
          <Image
            src="/enfusion-university-lockup.png"
            alt="Enfusion University"
            width={1600}
            height={388}
          />
        </Link>
        <span>{name}</span>
        <Link href="/university">STUDENT CAMPUS ↗</Link>
      </header>
      <nav aria-label="Faculty workspace">
        <button
          data-on={view === "teaching"}
          onClick={() => setView("teaching")}
        >
          TEACHING & REVIEW
        </button>
        <button data-on={view === "academy"} onClick={() => setView("academy")}>
          FACULTY ACADEMY
        </button>
      </nav>
      <section>
        {view === "teaching" ? (
          <Academy initialTab="review" context="university" />
        ) : (
          <GuideAcademy audience="FACULTY" />
        )}
      </section>
    </main>
  );
}
