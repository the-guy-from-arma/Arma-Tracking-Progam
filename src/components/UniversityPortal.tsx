"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Academy } from "@/components/Academy";
import { OwnerUniversitySettings } from "@/components/OwnerUniversitySettings";

type UniversityView = "dashboard" | "catalog" | "programs" | "submissions" | "credentials" | "settings";
const studentViews: { id: UniversityView; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "⌂" },
  { id: "catalog", label: "Courses", icon: "▤" },
  { id: "programs", label: "Programs", icon: "△" },
  { id: "submissions", label: "Assignments", icon: "◇" },
  { id: "credentials", label: "Academic record", icon: "▦" },
];

type PortalUser = { name: string; role: string; academicEmail: string | null; studentNumber: string | null };

export function UniversityPortal({ user }: { user: PortalUser }) {
  const [view, setView] = useState<UniversityView>("dashboard");
  const router = useRouter();
  const views = user.role === "OWNER" ? [...studentViews, { id: "settings" as const, label: "Owner settings", icon: "⚙" }] : studentViews;
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/"); router.refresh(); }

  return <main className="universityShell">
    <aside className="universityRail">
      <Link href="/" className="universityBrand"><b>EU</b><span><strong>ENFUSION</strong><small>UNIVERSITY</small></span></Link>
      <nav>{views.map((item) => <button key={item.id} className={view === item.id ? "on" : ""} onClick={() => setView(item.id)}><i>{item.icon}</i>{item.label}</button>)}</nav>
      <div className="studentIdentity"><span>{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{user.name}</strong><small>{user.academicEmail || "FACULTY / ADMINISTRATION"}</small><em>{user.studentNumber || user.role}</em></div></div>
      <button className="universityLogout" onClick={logout}>SIGN OUT ↗</button>
    </aside>
    <section className="universitySurface">
      <header className="universityTop"><button className="universityMenu">EU</button><div><span>ENFUSION UNIVERSITY</span><b>{views.find((item) => item.id === view)?.label}</b></div><Link href="/valoris">PROJECT VALORIS ↗</Link></header>
      <div className="universityViewport">{view === "dashboard" ? <UniversityHome user={user} open={setView} /> : view === "settings" ? <OwnerUniversitySettings /> : <Academy key={view} initialTab={view} context="university" />}</div>
    </section>
  </main>;
}

function UniversityHome({ user, open }: { user: PortalUser; open: (view: UniversityView) => void }) {
  return <>
    <section className="campusHero"><div><p>STUDENT PORTAL / ACADEMIC YEAR 2026</p><h1>Welcome to Enfusion University, <em>{user.name.split(" ")[0]}.</em></h1><span>Your campus brings courses, assessed mod assignments, studio feedback, programs, and verified learner records into one focused academic workspace.</span><div><button onClick={() => open("catalog")}>CONTINUE TO COURSES →</button><button onClick={() => open("programs")}>VIEW DEGREE PATHS</button>{user.role === "OWNER" && <button onClick={() => open("settings")}>OPEN OWNER SETTINGS</button>}</div></div><aside><small>INSTITUTION IDENTITY</small><strong>{user.academicEmail || "Faculty access"}</strong><span>{user.studentNumber || "Academic administration"}</span></aside></section>
    <div className="campusColumns"><section><header><span>01</span><h2>ACADEMIC QUICK ACCESS</h2></header><div className="quickGrid"><button onClick={() => open("catalog")}><i>▤</i><b>My courses</b><span>Enrollment and course catalog</span></button><button onClick={() => open("submissions")}><i>◇</i><b>Assignments</b><span>Mod submissions and feedback</span></button><button onClick={() => open("programs")}><i>△</i><b>Programs</b><span>Certificates through degree paths</span></button><button onClick={() => open("credentials")}><i>▦</i><b>Learner record</b><span>Credits and verifiable credentials</span></button></div></section><aside><header><span>02</span><h2>STUDENT SERVICES</h2></header><ul><li><b>Academic advising</b><span>Program planning and progression</span></li><li><b>Technical support</b><span>Workbench and campus assistance</span></li><li><b>Registrar</b><span>Identity, records, and credentials</span></li><li><b>Accessibility services</b><span>Learning accommodations</span></li></ul></aside></div>
    <section className="campusDisclosure"><b>INSTITUTIONAL STATUS</b><p>Enfusion University is a community-based online development school. Its programs and learning credits are non-accredited unless a recognized authority formally grants accreditation or an external institution explicitly accepts transfer credit.</p></section>
  </>;
}
