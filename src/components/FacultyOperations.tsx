"use client";

import { useEffect, useState } from "react";
import styles from "./FacultyOperations.module.css";

type Profile = {
  id: string;
  name: string;
  title: string;
  academy: string | null;
  specialty: string;
  availability: string;
  active: boolean;
  deliveryMode: "AUTOMATED" | "ASSISTED" | "HUMAN" | "PAUSED";
  linkedUser: { id: string; name: string; academicEmail: string | null } | null;
  _count: { assignments: number; conversations: number };
};

type Escalation = {
  id: string;
  student: { name: string; studentNumber: string | null };
  facultyProfile: { name: string };
  course: { code: string; title: string } | null;
  messages: { id: string; body: string; createdAt: string }[];
};

export function FacultyOperations() {
  const [data, setData] = useState<{ profiles: Profile[]; escalations: Escalation[]; messagingEnabled: boolean; model: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({ name: "", title: "University Faculty", academy: "", specialty: "" });

  async function load() {
    const response = await fetch("/api/admin/university/faculty", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) setData(payload);
    else setNotice(payload.error || "Faculty operations could not be loaded.");
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/university/faculty", { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, payload: await response.json() }))
      .then(({ ok, payload }) => {
        if (!active) return;
        if (ok) setData(payload);
        else setNotice(payload.error || "Faculty operations could not be loaded.");
      });
    return () => { active = false; };
  }, []);

  async function updateProfile(profile: Profile, changes: Record<string, unknown>) {
    const response = await fetch("/api/admin/university/faculty", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: profile.id, ...changes }) });
    const payload = await response.json();
    setNotice(response.ok ? `${profile.name} was updated.` : payload.error || "Faculty profile could not be updated.");
    if (response.ok) await load();
  }

  async function createProfile(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/university/faculty", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...draft, slug: draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") }) });
    const payload = await response.json();
    setNotice(response.ok ? `${draft.name} was added to the faculty directory.` : payload.error || "Faculty profile could not be created.");
    if (response.ok) { setDraft({ name: "", title: "University Faculty", academy: "", specialty: "" }); await load(); }
  }

  async function resolveEscalation(id: string, ownerMessage: string) {
    const response = await fetch("/api/admin/university/faculty", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: id, ownerMessage, resolve: true }) });
    const payload = await response.json();
    setNotice(response.ok ? "The intervention was recorded and the escalation was resolved." : payload.error || "The escalation could not be resolved.");
    if (response.ok) await load();
  }

  return (
    <div className={styles.workspace}>
      <header className={styles.intro}>
        <div><small>ACADEMIC SERVICES / FACULTY NETWORK</small><h1>Faculty operations</h1><p>Shape faculty identities, control delivery, connect staff accounts, and step into escalated student conversations.</p></div>
        <aside data-online={data?.messagingEnabled}><span>{data?.messagingEnabled ? "Messaging connected" : "Messaging paused"}</span><b>{data?.model || "Loading configuration"}</b></aside>
      </header>
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      <section className={styles.section}>
        <div className={styles.sectionTitle}><div><small>UNIVERSITY DIRECTORY</small><h2>Faculty appointments</h2></div><b>{data?.profiles.length || 0} profiles</b></div>
        <div className={styles.directory}>
          {data?.profiles.map((profile) => (
            <article key={profile.id} className={styles.profile}>
              <div className={styles.identity}><span>{profile.name.split(" ").map((part) => part[0]).slice(-2).join("")}</span><div><small>{profile.academy || "University advising"}</small><h3>{profile.name}</h3><p>{profile.title}</p></div></div>
              <p>{profile.specialty}</p>
              <dl><div><dt>Students</dt><dd>{profile._count.assignments}</dd></div><div><dt>Threads</dt><dd>{profile._count.conversations}</dd></div><div><dt>Account</dt><dd>{profile.linkedUser ? "Linked" : "Persona"}</dd></div></dl>
              <div className={styles.controls}>
                <label>Delivery<select value={profile.deliveryMode} onChange={(event) => void updateProfile(profile, { deliveryMode: event.target.value })}><option>AUTOMATED</option><option>ASSISTED</option><option>HUMAN</option><option>PAUSED</option></select></label>
                <button onClick={() => void updateProfile(profile, { active: !profile.active })}>{profile.active ? "Pause profile" : "Activate profile"}</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.split}>
        <form className={styles.create} onSubmit={createProfile}>
          <small>NEW APPOINTMENT</small><h2>Create a faculty profile</h2><p>Profiles can operate independently or later be linked to a faculty account.</p>
          <label>Faculty name<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>Academic title<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label>Academy<input value={draft.academy} onChange={(event) => setDraft({ ...draft, academy: event.target.value })} /></label>
          <label>Specialty<textarea required value={draft.specialty} onChange={(event) => setDraft({ ...draft, specialty: event.target.value })} /></label>
          <button type="submit">Create appointment →</button>
        </form>
        <div className={styles.escalations}>
          <small>OWNER INTERVENTION</small><h2>Open escalations</h2>
          {!data?.escalations.length ? <p className={styles.empty}>No conversations currently require owner intervention.</p> : data.escalations.map((item) => <EscalationRecord key={item.id} item={item} onResolve={resolveEscalation} />)}
        </div>
      </section>
    </div>
  );
}

function EscalationRecord({ item, onResolve }: { item: Escalation; onResolve: (id: string, message: string) => Promise<void> }) {
  const [message, setMessage] = useState("");
  return <article className={styles.escalation}><small>{item.course ? `${item.course.code} · ${item.course.title}` : "ACADEMIC ADVISING"}</small><h3>{item.student.name} with {item.facultyProfile.name}</h3><p>{item.messages[0]?.body || "This thread was escalated for review."}</p><textarea placeholder="Add an owner response before resolving…" value={message} onChange={(event) => setMessage(event.target.value)} /><button disabled={message.trim().length < 2} onClick={() => void onResolve(item.id, message)}>Respond and resolve</button></article>;
}
