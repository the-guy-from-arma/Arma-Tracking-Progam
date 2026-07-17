"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { OwnerUniversitySettings } from "@/components/OwnerUniversitySettings";
import { UniversityLearning } from "@/components/UniversityLearning";
import { Academy } from "@/components/Academy";

export type UniversityView = "dashboard" | "programs" | "catalog" | "learning" | "funding" | "notifications" | "credentials" | "submissions" | "faculty" | "settings";
const studentViews: { id: UniversityView; label: string; icon: string }[] = [
  { id: "dashboard", label: "Home", icon: "⌂" },
  { id: "programs", label: "Programs", icon: "◎" },
  { id: "catalog", label: "Courses", icon: "◫" },
  { id: "learning", label: "Learning", icon: "▶" },
  { id: "funding", label: "Funding", icon: "$" },
  { id: "notifications", label: "Notifications", icon: "◉" },
  { id: "submissions", label: "Assessment", icon: "◇" },
  { id: "credentials", label: "Credentials", icon: "✦" },
];

type PortalUser = { name: string; role: string; academicEmail: string | null; studentNumber: string | null };

export function UniversityPortal({ user }: { user: PortalUser }) {
  const [view, setView] = useState<UniversityView>(() => {
    if (typeof window === "undefined") return "dashboard";
    const requested = new URLSearchParams(window.location.search).get("view") as UniversityView | null;
    const allowed = user.role === "OWNER" ? [...studentViews.map((item) => item.id), "faculty", "settings"] : studentViews.map((item) => item.id);
    return requested && allowed.includes(requested) ? requested : "dashboard";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const views = user.role === "OWNER" ? [...studentViews, { id: "faculty" as const, label: "AI exceptions", icon: "!" }, { id: "settings" as const, label: "Owner settings", icon: "⚙" }] : studentViews;
  function choose(next: UniversityView) { setView(next); setMobileOpen(false); window.history.replaceState(null, "", `/university?view=${next}`); }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/"); router.refresh(); }

  return <main className="glassCampus">
    <div className="campusAurora" aria-hidden="true"><i/><i/><i/></div>
    <aside className={`glassRail ${mobileOpen ? "open" : ""}`}>
      <Link href="/" className="glassBrand"><b>EU</b><span><strong>ENFUSION</strong><small>UNIVERSITY</small></span></Link>
      <nav aria-label="University navigation">{views.map((item) => <button key={item.id} className={view === item.id ? "on" : ""} onClick={() => choose(item.id)}><i>{item.icon}</i><span>{item.label}</span>{item.id === "notifications" && <em/>}</button>)}</nav>
      <div className="glassIdentity"><span>{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{user.name}</strong><small>{user.academicEmail || "FACULTY / ADMINISTRATION"}</small><em>{user.studentNumber || user.role}</em></div></div>
      <button className="glassLogout" onClick={logout}>SIGN OUT ↗</button>
    </aside>
    {mobileOpen && <button aria-label="Close navigation" className="railScrim" onClick={() => setMobileOpen(false)}/>}
    <section className="campusSurface">
      <header className="glassTop"><button className="campusMenu" onClick={() => setMobileOpen(true)} aria-label="Open navigation">EU</button><div><span>ENFUSION UNIVERSITY / STUDENT CAMPUS</span><b>{views.find((item) => item.id === view)?.label}</b></div><div className="campusStatus"><i/> CAMPUS ONLINE</div><Link href="/valoris">PROJECT VALORIS ↗</Link></header>
      <AnimatePresence mode="wait"><motion.div key={view} className="glassViewport" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .24 }}>
        {view === "settings" ? <OwnerUniversitySettings /> : view === "faculty" ? <Academy initialTab="review" context="university" /> : <UniversityLearning view={view as Exclude<UniversityView,"settings"|"faculty">} userName={user.name} onNavigate={choose}/>}
      </motion.div></AnimatePresence>
    </section>
  </main>;
}
