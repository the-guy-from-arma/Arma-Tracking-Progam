"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { OwnerUniversitySettings } from "@/components/OwnerUniversitySettings";
import { UniversityLearning } from "@/components/UniversityLearning";
import { Academy } from "@/components/Academy";

type UniversityView = "dashboard" | "catalog" | "programs" | "submissions" | "credentials" | "faculty" | "settings";
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
  const views = user.role === "OWNER" ? [...studentViews, { id: "faculty" as const, label: "Faculty review", icon: "✓" }, { id: "settings" as const, label: "Owner settings", icon: "⚙" }] : studentViews;
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
      <div className="universityViewport">{view === "settings" ? <OwnerUniversitySettings /> : view === "faculty" ? <Academy initialTab="review" context="university" /> : <UniversityLearning key={view} view={view} userName={user.name} />}</div>
    </section>
  </main>;
}
