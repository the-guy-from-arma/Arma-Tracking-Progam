"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./OperationsWorkspace.module.css";

type Application = {
  id: string;
  status: string;
  submittedAt: string;
  learningGoals: string;
  user: {
    name: string;
    academicEmail: string | null;
    email: string;
    studentNumber: string | null;
  };
};
type Faculty = {
  id: string;
  name: string;
  email: string;
  academicEmail: string | null;
  specialty: string | null;
  suspended: boolean;
  createdAt: string;
};
type Data = {
  applications: Application[];
  faculty: Faculty[];
  summary: {
    students: number;
    admitted: number;
    submitted: number;
    waitlisted: number;
    availableFundingCents: number;
  };
};
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);

export function AdminOverview() {
  const [data, setData] = useState<Data | null>(null);
  const [ai, setAi] = useState<{
    model: string;
    ready: boolean;
    connectionMessage: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/university", {
      cache: "no-store",
    });
    const result = await response.json();
    response.ok ? setData(result) : setMessage(result.error);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
      void fetch("/api/admin/ai-status")
        .then((response) => response.json())
        .then(setAi);
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function decide(applicationId: string, status: string) {
    const response = await fetch("/api/admin/university", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "set_status",
        applicationId,
        status,
        note: "Decision recorded in admissions workspace.",
      }),
    });
    const result = await response.json();
    setMessage(response.ok ? `Application moved to ${status}.` : result.error);
    if (response.ok) await load();
  }

  async function createFaculty(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setMessage("");
    const form = event.currentTarget;
    const response = await fetch("/api/admin/university", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const result = await response.json();
    setCreating(false);
    if (!response.ok) {
      setMessage(result.error);
      return;
    }
    setMessage(`Faculty account created: ${result.faculty.academicEmail}`);
    form.reset();
    await load();
  }

  return (
    <section className={styles.workspace}>
      <header className={styles.hero}>
        <div>
          <small>OWNER CONTROL / UNIVERSITY OPERATIONS</small>
          <h1>Institutional Operations</h1>
          <p>
            Admissions, protected AI services, and faculty identity management
            share one audited administrative record.
          </p>
        </div>
        <b>{ai?.ready ? "AI SERVICE READY" : "AI SETUP REQUIRED"}</b>
      </header>
      {message && <p className={styles.message}>{message}</p>}
      <div className={styles.metrics}>
        <article>
          <b>{data?.summary.students || 0}</b>
          <span>STUDENTS</span>
        </article>
        <article>
          <b>{data?.summary.admitted || 0}</b>
          <span>ADMITTED</span>
        </article>
        <article>
          <b>{data?.faculty.length || 0}</b>
          <span>FACULTY ACCOUNTS</span>
        </article>
        <article>
          <b>{money(data?.summary.availableFundingCents || 0)}</b>
          <span>SPONSORED BALANCES</span>
        </article>
      </div>

      <section className={styles.facultyOffice}>
        <header>
          <small>FACULTY IDENTITY OFFICE</small>
          <h2>Create a faculty account</h2>
          <p>
            Creates a secured FACULTY role with a private recovery address and
            an internal @enfusionuniversity.edu campus identity.
          </p>
        </header>
        <form onSubmit={createFaculty}>
          <label>
            <span>FACULTY NAME</span>
            <input
              name="name"
              required
              minLength={2}
              placeholder="Professor Jordan Ellis"
            />
          </label>
          <label>
            <span>RECOVERY EMAIL</span>
            <input
              name="email"
              required
              type="email"
              placeholder="jordan@example.com"
            />
          </label>
          <label>
            <span>TEACHING SPECIALTY</span>
            <input
              name="specialty"
              required
              minLength={3}
              placeholder="Enforce Script and gameplay systems"
            />
          </label>
          <label>
            <span>TEMPORARY PASSWORD</span>
            <input
              name="password"
              required
              type="password"
              minLength={12}
              placeholder="At least 12 characters"
            />
          </label>
          <button disabled={creating}>
            {creating
              ? "CREATING FACULTY IDENTITY…"
              : "CREATE FACULTY ACCOUNT →"}
          </button>
        </form>
        <div className={styles.facultyRoster}>
          {data?.faculty.map((member) => (
            <article key={member.id}>
              <i>
                {member.name
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
              </i>
              <span>
                <b>{member.name}</b>
                <small>{member.specialty}</small>
                <code>{member.academicEmail}</code>
              </span>
              <strong>{member.suspended ? "SUSPENDED" : "ACTIVE"}</strong>
            </article>
          ))}
          {!data?.faculty.length && (
            <p>No faculty accounts have been created yet.</p>
          )}
        </div>
      </section>

      <section className={styles.policy}>
        <header>
          <small>GEMINI UNIVERSITY SERVICE</small>
          <h2>{ai?.model || "Checking protected configuration…"}</h2>
          <p>{ai?.connectionMessage}</p>
        </header>
      </section>
      <div className={styles.table}>
        <div className={`${styles.tableHead} ${styles.fundingHead}`}>
          <span>STUDENT</span>
          <span>STATUS</span>
          <span>ACADEMIC INTENT</span>
          <span>SUBMITTED</span>
          <span>DECISION</span>
        </div>
        {data?.applications.map((application) => (
          <article
            className={`${styles.row} ${styles.fundingRow}`}
            key={application.id}
          >
            <span>
              <b>{application.user.name}</b>
              <small>
                {application.user.studentNumber ||
                  application.user.academicEmail ||
                  application.user.email}
              </small>
            </span>
            <strong data-status={application.status}>
              {application.status}
            </strong>
            <span>{application.learningGoals}</span>
            <span>
              {new Date(application.submittedAt).toLocaleDateString()}
            </span>
            <span>
              <button onClick={() => void decide(application.id, "ADMITTED")}>
                ADMIT
              </button>{" "}
              <button onClick={() => void decide(application.id, "WAITLISTED")}>
                WAITLIST
              </button>
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
