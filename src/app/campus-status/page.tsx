import Image from "next/image";
import Link from "next/link";
import { campusStatus } from "@/lib/campus-operations";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function CampusStatusPage() {
  const status = await campusStatus();
  const services = [
    ["Admissions submissions", status.availability.admissions],
    ["New enrollment", status.availability.enrollment],
    ["Lesson reading", status.availability.lessonReading],
    ["Lesson progress and quizzes", status.availability.lessonProgress],
    ["Assignments and grading", status.availability.submissions && status.availability.gradingFinalization],
    ["Records, policies, and receipts", true],
    ["Campus messages", status.availability.messages],
  ];
  return <main className={styles.page} data-season={status.season}>
    <header><Link href="/"><Image src="/enfusion-university-lockup.png" alt="Enfusion University" width={1600} height={388} priority /></Link><span>INSTITUTIONAL STATUS</span></header>
    <section className={styles.hero}><span>{status.learningMode.replaceAll("_", " ")}</span><h1>{status.publicTitle}</h1><p>{status.publicMessage}</p>{status.reopensAt && <time dateTime={status.reopensAt.toISOString()}>Scheduled reopening<br/><b>{new Date(status.reopensAt).toLocaleString("en-US", { timeZone: status.timezone, dateStyle: "full", timeStyle: "short" })}</b></time>}</section>
    <section className={styles.services}><header><span>LIVE SERVICE AVAILABILITY</span><h2>What you can use right now</h2></header>{services.map(([label, available]) => <div key={String(label)}><i data-open={available} /><b>{label}</b><span>{available ? "AVAILABLE" : "TEMPORARILY PAUSED"}</span></div>)}</section>
    <footer><Link href="/university/login">Student sign in</Link><Link href="/policies">Policies and agreements</Link><small>Records and signed receipts remain protected during every operating period.</small></footer>
  </main>;
}
