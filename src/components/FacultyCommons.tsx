"use client";

import { motion } from "motion/react";
import {
  ArrowRight,
  BookOpen,
  Building2,
  MessageCircle,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AcademicLoader } from "./AcademicLoader";
import styles from "./FacultyCommons.module.css";

type FacultyMember = {
  id: string;
  slug: string;
  name: string;
  title: string;
  initials: string;
  academy: string | null;
  specialty: string;
  biography: string;
  teachingPhilosophy: string;
  availability: string;
  isPrimaryAdvisor: boolean;
  conversationId: string | null;
};

export function FacultyCommons({
  onMessage,
}: {
  onMessage: (slug: string) => void;
}) {
  const [faculty, setFaculty] = useState<FacultyMember[] | null>(null);
  const [search, setSearch] = useState("");
  const [academy, setAcademy] = useState("ALL");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/university/faculty", {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 428) {
        window.location.assign(
          `${result.policyGateUrl || "/policies/accept"}?returnTo=${encodeURIComponent("/university?view=faculty")}`,
        );
        return;
      }
      if (!response.ok)
        throw new Error(result.error || "Faculty Commons could not be opened.");
      setFaculty(result.faculty || []);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Faculty Commons could not be opened.",
      );
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const leadership = useMemo(
    () => faculty?.filter((member) => !member.academy) || [],
    [faculty],
  );
  const professors = useMemo(
    () => faculty?.filter((member) => Boolean(member.academy)) || [],
    [faculty],
  );
  const academies = useMemo(
    () =>
      [...new Set(professors.map((member) => member.academy).filter(Boolean))] as string[],
    [professors],
  );
  const visibleFaculty = useMemo(() => {
    const query = search.trim().toLowerCase();
    return professors.filter(
      (member) =>
        (academy === "ALL" || member.academy === academy) &&
        (!query ||
          `${member.name} ${member.title} ${member.academy} ${member.specialty}`
            .toLowerCase()
            .includes(query)),
    );
  }, [academy, professors, search]);

  if (!faculty && !error)
    return <AcademicLoader label="Opening Faculty Commons" />;
  if (error)
    return (
      <section className={styles.failure} role="alert">
        <Users size={28} />
        <h1>Faculty Commons did not finish opening.</h1>
        <p>{error}</p>
        <button onClick={() => void load()}>Try again</button>
      </section>
    );

  return (
    <section className={styles.commons}>
      <motion.header
        className={styles.hero}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className={styles.heroCopy}>
          <p><span /> Faculty Commons</p>
          <h1>People to guide the work.</h1>
          <span>
            Meet university leadership and the faculty responsible for each
            technical academy. Open a private conversation whenever you need a
            clear next step.
          </span>
          <button
            onClick={() =>
              onMessage(
                leadership.find((member) => member.isPrimaryAdvisor)?.slug ||
                  "elara-voss",
              )
            }
          >
            Message your academic advisor <ArrowRight size={17} />
          </button>
        </div>
        <div className={styles.heroOrbit} aria-hidden="true">
          <div><Users size={32} /></div>
          <span>{faculty?.length || 0}<small>faculty and offices</small></span>
          <i /><i /><i />
        </div>
      </motion.header>

      <section className={styles.leadership}>
        <header className={styles.sectionTitle}>
          <div>
            <p>University leadership and student services</p>
            <h2>Your institutional support network</h2>
          </div>
          <Building2 size={28} />
        </header>
        <div className={styles.leadershipRail}>
          {leadership.map((member, index) => (
            <motion.article
              key={member.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
            >
              <div className={styles.portrait}>{member.initials}<i /></div>
              <small>{member.isPrimaryAdvisor ? "Continuing advisor" : "University office"}</small>
              <h3>{member.name}</h3>
              <b>{member.title}</b>
              <p>{member.biography}</p>
              <button onClick={() => onMessage(member.slug)}>
                <MessageCircle size={15} /> Message {member.name.split(" ").at(-1)}
              </button>
            </motion.article>
          ))}
        </div>
      </section>

      <section className={styles.academicFaculty}>
        <header className={styles.sectionTitle}>
          <div>
            <p>Academic faculty</p>
            <h2>Find expertise by academy</h2>
          </div>
          <BookOpen size={28} />
        </header>
        <div className={styles.directoryControls}>
          <label>
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search faculty or a technical specialty"
              aria-label="Search faculty or specialty"
            />
          </label>
          <select
            value={academy}
            onChange={(event) => setAcademy(event.target.value)}
            aria-label="Filter faculty by academy"
          >
            <option value="ALL">All academies</option>
            {academies.map((item) => <option key={item}>{item}</option>)}
          </select>
          <span>{visibleFaculty.length} faculty</span>
        </div>

        <div className={styles.facultyIndex}>
          {visibleFaculty.map((member, index) => (
            <motion.article
              key={member.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 8) * 0.04 }}
            >
              <div className={styles.facultyIdentity}>
                <div className={styles.portrait}>{member.initials}<i /></div>
                <span>
                  <small>{member.academy}</small>
                  <h3>{member.name}</h3>
                  <b>{member.title}</b>
                </span>
              </div>
              <p>{member.biography}</p>
              <blockquote>“{member.teachingPhilosophy}”</blockquote>
              <footer>
                <span><Sparkles size={14} /> {member.specialty}</span>
                <button onClick={() => onMessage(member.slug)}>
                  Message faculty <ArrowRight size={16} />
                </button>
              </footer>
            </motion.article>
          ))}
          {!visibleFaculty.length && (
            <div className={styles.empty}>No faculty match this search.</div>
          )}
        </div>
      </section>
    </section>
  );
}
