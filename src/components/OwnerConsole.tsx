"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Academy } from "@/components/Academy";
import { OwnerUniversitySettings } from "@/components/OwnerUniversitySettings";
import styles from "./OwnerConsole.module.css";

type OwnerView = "operations" | "exceptions";

export function OwnerConsole({ ownerName }: { ownerName: string }) {
  const [view, setView] = useState<OwnerView>("operations");
  const router = useRouter();
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/"); router.refresh(); }
  return <main className={styles.console}>
    <header className={styles.top}><Link href="/" className={styles.brand}><b>OA</b><span><strong>OWNER ADMINISTRATION</strong><small>SEPARATE INSTITUTIONAL CONTROL</small></span></Link><div className={styles.owner}><i/><span><small>AUTHORIZED OWNER</small><b>{ownerName}</b></span></div><button onClick={logout}>SIGN OUT</button></header>
    <aside className={styles.rail}><p>CONTROL AREAS</p><button className={view === "operations" ? styles.active : ""} onClick={() => setView("operations")}><i>01</i><span><b>Operations</b><small>Admissions, funding, curriculum and AI</small></span></button><button className={view === "exceptions" ? styles.active : ""} onClick={() => setView("exceptions")}><i>02</i><span><b>AI exceptions</b><small>Human review and assessment oversight</small></span></button><footer><strong>STUDENT CAMPUS SEPARATION</strong><p>This surface is owner-only and is not part of university student navigation.</p><Link href="/university">VIEW STUDENT CAMPUS ↗</Link></footer></aside>
    <section className={styles.surface}><div className={styles.context}><span>OWNER / {view.toUpperCase()}</span><b>{view === "operations" ? "Institutional operations" : "Assessment exceptions"}</b></div>{view === "operations" ? <OwnerUniversitySettings /> : <Academy initialTab="review" context="university" />}</section>
  </main>;
}
