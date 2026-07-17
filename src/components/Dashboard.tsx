"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Academy } from "@/components/Academy";

type User = { id: string; email: string; name: string; role: string; specialty: string | null; createdAt: string | Date };
type Project = { id: string; code: string; name: string; description: string; type: string; status: string; progress: number; repository: string | null; createdAt: string | Date; updatedAt: string | Date; owner: { id: string; name: string; role: string }; members: { id: string }[] };

const navigation = [
  { id: "overview", label: "Overview", icon: "⌁" },
  { id: "projects", label: "Projects", icon: "▦" },
  { id: "academy", label: "Academy", icon: "△" },
  { id: "credentials", label: "Credentials", icon: "◇" },
  { id: "approvals", label: "Approvals", icon: "◆" },
  { id: "team", label: "Community", icon: "◎" },
];

const titles: Record<string, string> = { overview: "VALORIS overview", projects: "Development hub", academy: "VALORIS academy", credentials: "Credential wallet", approvals: "Project approvals", team: "Developer community" };

export function Dashboard({ initialUser, initialProjects, initialUsers }: { initialUser: User; initialProjects: Project[]; initialUsers: User[] }) {
  const router = useRouter();
  const search = useSearchParams();
  const requestedView = search.get("view") || "overview";
  const [view, setView] = useState(navigation.some((item) => item.id === requestedView) ? requestedView : "overview");
  const [projects, setProjects] = useState(initialProjects);
  const [users, setUsers] = useState(initialUsers);
  const [modal, setModal] = useState(false);
  const [boot, setBoot] = useState(true);
  const [toast, setToast] = useState("");
  const admin = ["OWNER", "ADMIN"].includes(initialUser.role);

  useEffect(() => {
    const seen = sessionStorage.getItem("valoris.boot");
    const timer = setTimeout(() => { setBoot(false); if (!seen) sessionStorage.setItem("valoris.boot", "1"); }, seen ? 0 : 2700);
    return () => clearTimeout(timer);
  }, []);

  const pending = projects.filter((project) => project.status === "PENDING");
  const notify = (message: string) => { setToast(message); setTimeout(() => setToast(""), 2500); };
  const changeView = (next: string) => { setView(next); history.replaceState(null, "", next === "overview" ? "/valoris" : `/valoris?view=${next}`); };

  async function refresh() {
    const [projectResult, userResult] = await Promise.all([fetch("/api/projects").then((response) => response.json()), fetch("/api/users").then((response) => response.json())]);
    setProjects(projectResult.projects || []); setUsers(userResult.users || []);
  }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }
  async function review(id: string, approved: boolean) { const response = await fetch(`/api/projects/${id}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ approved }) }); if (response.ok) { await refresh(); notify(approved ? "Project authorized" : "Project returned"); } }
  async function role(id: string, next: string) { const response = await fetch(`/api/users/${id}/role`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: next }) }); if (response.ok) { await refresh(); notify("Community role updated"); } }

  if (boot) return <Boot onSkip={() => setBoot(false)}/>;
  return <main className="app">
    <aside className="rail"><Brand/><nav>{navigation.map((item) => <button key={item.id} className={view === item.id ? "on" : ""} onClick={() => changeView(item.id)}><i>{item.icon}</i><span>{item.label}</span>{item.id === "approvals" && pending.length > 0 && <b>{pending.length}</b>}</button>)}</nav><div className="railStatus"><i/> VALORIS NETWORK ONLINE</div><button className="userChip" onClick={logout}><span>{initialUser.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{initialUser.name}</strong><small>{initialUser.role}</small></div><b>↗</b></button></aside>
    <section className="surface"><header className="appHead"><button className="miniBrand" onClick={() => changeView("overview")}>P//V</button><div><span>PROJECT VALORIS /</span> {titles[view].toUpperCase()}</div>{["overview", "projects"].includes(view) && <button className="create" onClick={() => setModal(true)}>＋ PROJECT</button>}</header><div className="viewport"><div className="pageIntro"><div><p className="kicker">DEVELOPMENT HUB + LEARNING NETWORK</p><h1>{titles[view]}<em>.</em></h1><p>{view === "overview" ? `Welcome back, ${initialUser.name.split(" ")[0]}. Build mods, develop your craft, and document your progress.` : subcopy(view)}</p></div><div className="studioLockup"><small>FOUNDING STUDIOS</small><b>THUNDER BUDDIES</b><span>×</span><b>BLACK RIDGE</b></div></div>
      {view === "overview" && <Overview projects={projects} users={users} pending={pending} onView={changeView}/>}
      {view === "projects" && <Projects projects={projects}/>}
      {view === "academy" && <Academy/>}
      {view === "credentials" && <Academy initialTab="credentials"/>}
      {view === "approvals" && <Approvals pending={pending} canReview={admin} review={review}/>}
      {view === "team" && <Team users={users} owner={initialUser.role === "OWNER"} changeRole={role}/>}
    </div></section>
    <nav className="mobileNav">{navigation.slice(0, 4).map((item) => <button key={item.id} className={view === item.id ? "on" : ""} onClick={() => changeView(item.id)}><i>{item.icon}</i><span>{item.label}</span></button>)}</nav>
    {modal && <ProjectModal close={() => setModal(false)} saved={async () => { setModal(false); await refresh(); notify("Project sent for authorization"); }}/>}
    {toast && <div className="toast">✓ {toast}</div>}
  </main>;
}

function Overview({ projects, users, pending, onView }: { projects: Project[]; users: User[]; pending: Project[]; onView: (view: string) => void }) {
  const active = projects.filter((project) => project.status === "ACTIVE");
  return <><section className="valorisWelcome"><div><span>PROJECT VALORIS</span><h2>Where Arma developers<br/>become <em>builders of record.</em></h2></div><p>A joint development and education initiative from Thunder Buddies Studios and Black Ridge Studios. Collaborate on live projects or enter the Academy to learn through assessed mod creation.</p><button onClick={() => onView("academy")}>EXPLORE THE ACADEMY →</button></section><section className="stats"><Stat n={active.length} label="ACTIVE PROJECTS" note="AUTHORIZED WORK"/><Stat n={projects.length} label="TOTAL PROJECTS" note="DEVELOPMENT HUB"/><Stat n={users.length} label="COMMUNITY DEVS" note="VALORIS NETWORK"/><Stat n={pending.length} label="AWAITING REVIEW" note="ADMIN ACTION" alert={pending.length > 0}/></section><Section num="01" title="ACTIVE DEVELOPMENT OPERATIONS" action={() => onView("projects")}><div className="cards">{active.length ? active.slice(0, 3).map((project) => <ProjectCard project={project} key={project.id}/>) : <Empty text="Authorized projects will appear here."/>}</div></Section><div className="split"><Section num="02" title="PROJECT APPROVAL QUEUE" action={() => onView("approvals")}><div className="queue">{pending.slice(0, 3).map((project) => <Request project={project} key={project.id}/>)}{!pending.length && <Empty text="No project requests need action."/>}</div></Section><Section num="03" title="ACADEMIC SIGNAL"><div className="signal"><b>{users.filter((user) => user.role === "TRAINEE").length}</b><span>DEVELOPERS IN TRAINING</span><p>Course submissions, studio review, credentials, and university-style progression now live in the VALORIS Academy.</p><button onClick={() => onView("academy")}>ENTER ACADEMY →</button></div></Section></div></>;
}

function Projects({ projects }: { projects: Project[] }) { return <div className="cards all">{projects.length ? projects.map((project) => <ProjectCard project={project} key={project.id}/>) : <Empty text="Create the first Project VALORIS workstream."/>}</div>; }
function Approvals({ pending, canReview, review }: { pending: Project[]; canReview: boolean; review: (id: string, approved: boolean) => void }) { return <section className="tablePanel"><div className="authority">{canReview ? "AUTHORITY VERIFIED — YOU MAY REVIEW PROJECTS" : "READ ONLY — ADMIN AUTHORITY REQUIRED"}</div>{pending.length ? pending.map((project) => <div className="approval" key={project.id}><span className="diamond">◇</span><div><strong>{project.name}</strong><small>{project.owner.name} · {project.type}</small></div><code>{project.code}</code><div className="actions"><button disabled={!canReview} onClick={() => review(project.id, false)}>RETURN</button><button disabled={!canReview} onClick={() => review(project.id, true)}>APPROVE</button></div></div>) : <Empty text="Authorization queue is clear."/>}</section>; }
function Team({ users, owner, changeRole }: { users: User[]; owner: boolean; changeRole: (id: string, role: string) => void }) { return <section className="tablePanel"><div className="authority">{owner ? "OWNER AUTHORITY — COMMUNITY ROLE CONTROLS ENABLED" : "ROLE ASSIGNMENT IS OWNER-ONLY"}</div>{users.map((user) => <div className="member" key={user.id}><span>{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{user.name}</strong><small>{user.specialty || "Specialty not set"} · {user.email}</small></div><select value={user.role} disabled={!owner || user.role === "OWNER"} onChange={(event) => changeRole(user.id, event.target.value)}>{user.role === "OWNER" && <option>OWNER</option>}<option>ADMIN</option><option>VETERAN</option><option>DEVELOPER</option><option>TRAINEE</option></select><i>● MEMBER</i></div>)}</section>; }

function ProjectModal({ close, saved }: { close: () => void; saved: () => void }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); const body = Object.fromEntries(new FormData(event.currentTarget)); const response = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) { setError(result.error); setBusy(false); return; } saved(); }
  return <div className="modalBack" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><form className="modal" onSubmit={submit}><header><div><p className="kicker">VALORIS PROJECT INTAKE / NEW</p><h2>Request a workstream</h2></div><button type="button" onClick={close}>×</button></header><p>Every member can submit. An owner or admin must authorize the workspace.</p><label>PROJECT NAME<input name="name" required minLength={3} autoFocus placeholder="Raven Vehicle Framework"/></label><label>TYPE<select name="type"><option value="GAMEPLAY">Gameplay system</option><option value="TERRAIN">Terrain / world</option><option value="VEHICLE">Vehicle / asset</option><option value="FRAMEWORK">Framework</option><option value="AUDIO">Audio</option><option value="TRAINING">Training</option><option value="OTHER">Other</option></select></label><label>MISSION BRIEF<textarea name="description" required minLength={12} placeholder="Purpose, scope, and intended players…"/></label><label>REPOSITORY <small>OPTIONAL</small><input name="repository" placeholder="https://github.com/unit/project"/></label>{error && <p className="formError">△ {error}</p>}<div className="modalActions"><button type="button" onClick={close}>CANCEL</button><button className="primary" disabled={busy}>{busy ? "TRANSMITTING…" : "SEND FOR APPROVAL →"}</button></div></form></div>;
}

function Boot({ onSkip }: { onSkip: () => void }) { return <main className="boot"><button onClick={onSkip}>SKIP ↗</button><div className="sweep"><i/><b/></div><div className="bootBrand"><Brand/></div><section><header><span>SYS.START / PROJECT VALORIS</span><span>ACADEMIC NODE 01</span></header>{["POSTGRES DATA LINK", "DEVELOPMENT HUB", "VALORIS ACADEMY", "CREDENTIAL NETWORK"].map((item, index) => <p key={item} style={{ animationDelay: `${index * .42}s` }}><i>◇</i>{item}<b>OK</b></p>)}<div><i/></div></section></main>; }
function Brand() { return <div className="brand"><b>V</b><span><strong>PROJECT VALORIS</strong><small>BUILD · LEARN · ADVANCE</small></span></div>; }
function Stat({ n, label, note, alert }: { n: number; label: string; note: string; alert?: boolean }) { return <article className={alert ? "alert" : ""}><span>{label}<i/></span><strong>{String(n).padStart(2, "0")}</strong><small>{note}</small></article>; }
function Section({ num, title, action, children }: { num: string; title: string; action?: () => void; children: React.ReactNode }) { return <section className="section"><header><div><span>{num}</span><h2>{title}</h2></div>{action && <button onClick={action}>VIEW ALL ↗</button>}</header>{children}</section>; }
function ProjectCard({ project }: { project: Project }) { return <article className="project"><header><span className={project.status.toLowerCase()}>● {project.status}</span><code>{project.code}</code></header><h3>{project.name}</h3><p>{project.description}</p><div className="progress"><span>PHASE COMPLETION <b>{project.progress}%</b></span><i><b style={{ width: `${project.progress}%` }}/></i></div><footer><span>◎ {project.owner.name}</span><span>◈ {project.members.length} CREW</span><span>{project.type}</span></footer></article>; }
function Request({ project }: { project: Project }) { return <div className="request"><span>◇</span><div><strong>{project.name}</strong><small>{project.owner.name} · {project.type}</small></div><code>{project.code}</code></div>; }
function Empty({ text }: { text: string }) { return <div className="empty"><b>◇</b><span>STANDING BY</span><p>{text}</p></div>; }
function subcopy(view: string) { return view === "projects" ? "Build and track live Arma Reforger development workstreams." : view === "academy" ? "Learn through studio-authored courses and assessed mod creation." : view === "credentials" ? "Your verified record of completed Project VALORIS learning." : view === "approvals" ? "Review project scope and ownership before activation." : "Connect developers, mentors, reviewers, and studio faculty."; }
