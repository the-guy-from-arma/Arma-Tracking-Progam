"use client";

import Link from "next/link";
import { motion } from "motion/react";

const reveal = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

export function PortalGateway({ user }: { user: { name: string; isStudent: boolean; role: string } | null }) {
  const universityReady = Boolean(user?.isStudent || ["OWNER", "ADMIN"].includes(user?.role || ""));
  return <main className="orbitGateway">
    <div className="gatewayAurora" aria-hidden="true"><i/><i/><i/></div>
    <header className="orbitHeader">
      <div className="orbitLockup"><b>V</b><span><strong>VALORIS NETWORK</strong><small>ONE IDENTITY / TWO WORLDS</small></span></div>
      {user ? <div className="orbitWelcome"><span>WELCOME BACK</span><b>{user.name}</b></div> : <Link href="/login" className="gatewaySignIn">SIGN IN</Link>}
    </header>
    <motion.section className="orbitIntro" {...reveal} transition={{ duration: .6 }}>
      <p>CHOOSE TODAY&apos;S MISSION</p>
      <h1>Build the future.<br/><em>Learn how it works.</em></h1>
      <span>Move between the development network and a complete Enfusion learning campus without breaking your flow.</span>
    </motion.section>
    <section className="orbitDestinations" aria-label="Choose a destination">
      <motion.div {...reveal} transition={{ delay: .12, duration: .65 }} whileHover={{ y: -8 }}>
        <Link href={user ? "/valoris" : "/login"} className="orbitWorld valorisWorld">
          <div className="worldAtmosphere" aria-hidden="true"><i/><i/><b>V</b></div>
          <header><span>01</span><small>DEVELOPMENT NETWORK</small></header>
          <div className="worldCopy"><p>PROJECT</p><h2>VALORIS</h2><span>Turn ideas into visible momentum through objectives, decisions, milestones, and shared technical intelligence.</span></div>
          <div className="worldSignals"><span>LIVE WORKSTREAMS</span><span>TEAM OBJECTIVES</span><span>KNOWLEDGE RECORD</span></div>
          <strong>ENTER VALORIS <i>↗</i></strong>
        </Link>
      </motion.div>
      <motion.div {...reveal} transition={{ delay: .22, duration: .65 }} whileHover={{ y: -8 }}>
        <Link href={universityReady ? "/university" : "/university/login"} className="orbitWorld universityWorld">
          <div className="worldAtmosphere" aria-hidden="true"><i/><i/><b>EU</b></div>
          <header><span>02</span><small>ONLINE CAMPUS</small></header>
          <div className="worldCopy"><p>ENFUSION</p><h2>UNIVERSITY</h2><span>Follow complete day-by-day Workbench pathways with source-grounded lessons, sponsored learning, and intelligent assessment.</span></div>
          <div className="worldSignals"><span>192 COURSES</span><span>144 PROGRAMS</span><span>16 ACADEMIES</span></div>
          <strong>ENTER UNIVERSITY <i>↗</i></strong>
        </Link>
      </motion.div>
    </section>
    <footer className="orbitFooter"><span>THUNDER BUDDIES STUDIOS</span><i>×</i><span>BLACK RIDGE STUDIOS</span><small>Enfusion University is an independent, non-accredited learning institution.</small><Link className="ownerAccess" href={user?.role === "OWNER" ? "/owner" : "/owner/login"}>OWNER ACCESS</Link></footer>
  </main>;
}
