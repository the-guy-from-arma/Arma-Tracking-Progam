"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Academy } from "@/components/Academy";
import { AcademicBoot } from "@/components/AcademicBoot";
import { CurriculumSources } from "@/components/CurriculumSources";
import { FundingOperations } from "@/components/FundingOperations";
import { GuideAcademy } from "@/components/GuideAcademy";
import { AdminOverview } from "@/components/AdminOverview";
import { FacultyOperations } from "@/components/FacultyOperations";
import { PolicyOperations } from "@/components/PolicyOperations";
import { CampusOperationsPanel } from "@/components/CampusOperationsPanel";
import styles from "./OwnerConsole.module.css";
type OwnerView =
  "operations" | "calendar" | "sources" | "funding" | "exceptions" | "faculty" | "policies" | "academy";
const controls: {
  id: OwnerView;
  number: string;
  title: string;
  detail: string;
}[] = [
  {
    id: "operations",
    number: "01",
    title: "Admissions",
    detail: "Applications, programs and AI status",
  },
  {
    id: "calendar",
    number: "02",
    title: "Campus Calendar",
    detail: "Breaks, recesses and service availability",
  },
  {
    id: "sources",
    number: "03",
    title: "Curriculum Sources",
    detail: "Diagnostics, mappings and sync history",
  },
  {
    id: "funding",
    number: "04",
    title: "Funding Ledger",
    detail: "Transactions and withdrawal policy",
  },
  {
    id: "exceptions",
    number: "05",
    title: "AI exceptions",
    detail: "Human review and appeals",
  },
  {
    id: "faculty",
    number: "06",
    title: "Faculty Network",
    detail: "Appointments, messaging and escalations",
  },
  {
    id: "policies",
    number: "07",
    title: "Policy Administration",
    detail: "Versions, consent, inquiries and AI disclosure",
  },
  {
    id: "academy",
    number: "08",
    title: "Administrator Academy",
    detail: "Interactive operating guides",
  },
];
export function OwnerConsole({ ownerName }: { ownerName: string }) {
  const [view, setView] = useState<OwnerView>("operations");
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <main className={styles.console}>
      <AcademicBoot label="UNIVERSITY ADMINISTRATION" />
      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          <Image
            src="/enfusion-university-lockup.png"
            alt="Enfusion University"
            width={1600}
            height={388}
          />
          <span>
            <strong>OWNER ADMINISTRATION</strong>
            <small>SEPARATE INSTITUTIONAL CONTROL</small>
          </span>
        </Link>
        <div className={styles.owner}>
          <i />
          <span>
            <small>AUTHORIZED OWNER</small>
            <b>{ownerName}</b>
          </span>
        </div>
        <button onClick={logout}>SIGN OUT</button>
      </header>
      <aside className={styles.rail}>
        <p>CONTROL AREAS</p>
        {controls.map((control) => (
          <button
            key={control.id}
            className={view === control.id ? styles.active : ""}
            onClick={() => setView(control.id)}
          >
            <i>{control.number}</i>
            <span>
              <b>{control.title}</b>
              <small>{control.detail}</small>
            </span>
          </button>
        ))}
        <footer>
          <strong>STUDENT CAMPUS SEPARATION</strong>
          <p>
            This surface is owner-only and is not part of student navigation.
          </p>
          <Link href="/university">VIEW STUDENT CAMPUS ↗</Link>
        </footer>
      </aside>
      <section className={styles.surface}>
        <div className={styles.context}>
          <span>OWNER / {view.toUpperCase()}</span>
          <b>Institutional control workspace</b>
        </div>
        {view === "operations" ? (
          <AdminOverview />
        ) : view === "calendar" ? (
          <CampusOperationsPanel />
        ) : view === "sources" ? (
          <CurriculumSources />
        ) : view === "funding" ? (
          <FundingOperations />
        ) : view === "faculty" ? (
          <FacultyOperations />
        ) : view === "policies" ? (
          <PolicyOperations />
        ) : view === "academy" ? (
          <GuideAcademy audience="ADMIN" />
        ) : (
          <Academy initialTab="review" context="university" />
        )}
      </section>
    </main>
  );
}
