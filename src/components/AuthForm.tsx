"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForm({
  mode,
  portal = "valoris",
}: {
  mode: "login" | "register";
  portal?: "valoris" | "university";
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const university = portal === "university";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const endpoint = university && mode === "register" ? "/api/auth/university-register" : `/api/auth/${mode}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Unable to continue");
      setBusy(false);
      return;
    }
    router.push(university ? "/university" : "/valoris");
    router.refresh();
  }

  const registerLink = university ? "/university/register" : "/register";
  const loginLink = university ? "/university/login" : "/login";

  return (
    <main className={`access ${university ? "universityAccess" : ""}`}>
      <Link className="backGateway" href="/">← CHOOSE PORTAL</Link>
      <div className="accessGrid" />
      <section className="accessIntro">
        <Brand university={university} />
        <p className="kicker">{university ? "ONLINE CAMPUS + STUDENT INFORMATION SYSTEM" : "ARMA DEVELOPMENT + STUDIO NETWORK"}</p>
        <h1>{university ? <>Study with purpose.<br /><em>Build with evidence.</em></> : <>Build your craft.<br /><em>Prove it in the field.</em></>}</h1>
        <p>{university ? "Enfusion University is a complete online campus for structured courses, assessed mod assignments, academic pathways, and durable learner records." : "Project VALORIS brings live development work, studio collaboration, approvals, and community leadership into one professional network."}</p>
        <div className="accessSignals">
          <span><i />{university ? "STUDENT PORTAL" : "THUNDER BUDDIES STUDIOS"}</span>
          <span><i />{university ? "LEARNER RECORDS" : "BLACK RIDGE STUDIOS"}</span>
          <span><i />{university ? "STUDIO FACULTY" : "PROJECT OPERATIONS"}</span>
        </div>
      </section>
      <form className="accessCard" onSubmit={submit}>
        <header>
          <span>{mode === "login" ? "AUTH.01" : university ? "ADMIT.01" : "JOIN.01"}</span>
          <div>
            <h2>{mode === "login" ? university ? "Student sign in" : "Enter Project VALORIS" : university ? "Apply to Enfusion University" : "Join Project VALORIS"}</h2>
            <p>{mode === "login" ? university ? "Use your internal EFU ID or recovery email." : "Open your development workspace." : university ? "Your internal institution identity is issued after registration." : "New members begin as developing creators."}</p>
          </div>
        </header>
        {mode === "register" && <>
          <label>LEGAL / DISPLAY NAME<input name="name" required minLength={2} autoComplete="name" placeholder="Alex Morgan" /></label>
          <label>DEVELOPMENT CONCENTRATION <small>OPTIONAL</small><input name="specialty" placeholder="Enfusion scripting, terrain, audio…" /></label>
        </>}
        <label>
          {university && mode === "login" ? "INTERNAL EFU ID OR RECOVERY EMAIL" : mode === "register" ? "PERSONAL / RECOVERY EMAIL" : "EMAIL"}
          <input name="email" required type="email" autoComplete="email" placeholder={university ? "alex.morgan@enfusionuniversity.edu" : "developer@studio.com"} />
        </label>
        <label>PASSWORD<input name="password" required type="password" minLength={mode === "login" ? 1 : 10} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="••••••••••••" /></label>
        {error && <p className="formError">△ {error}</p>}
        <button className="primary" disabled={busy}>{busy ? "ESTABLISHING LINK…" : mode === "login" ? university ? "ENTER STUDENT PORTAL →" : "ENTER VALORIS →" : university ? "CREATE STUDENT ACCOUNT →" : "CREATE MEMBER PROFILE →"}</button>
        <p className="formSwitch">
          {mode === "login" ? university ? "New student? " : "New to Project VALORIS? " : "Already registered? "}
          <Link href={mode === "login" ? registerLink : loginLink}>{mode === "login" ? university ? "Begin admissions" : "Apply to join" : "Sign in"}</Link>
        </p>
        {university && <p className="identityDisclosure">The @enfusionuniversity.edu EFU ID is an internal website login. It is not an internet email mailbox.</p>}
      </form>
      <footer className="accessFoot">{university ? "ENFUSION UNIVERSITY / COMMUNITY-BASED ONLINE EDUCATION" : "PROJECT VALORIS / THUNDER BUDDIES STUDIOS × BLACK RIDGE STUDIOS"} / 2026</footer>
    </main>
  );
}

function Brand({ university }: { university: boolean }) {
  return <div className="brand"><b>{university ? "EU" : "V"}</b><span><strong>{university ? "ENFUSION UNIVERSITY" : "PROJECT VALORIS"}</strong><small>{university ? "LEARN · BUILD · DEMONSTRATE" : "BUILD · COLLABORATE · SHIP"}</small></span></div>;
}
