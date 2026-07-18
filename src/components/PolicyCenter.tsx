"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./PolicyCenter.module.css";

type PolicyContent = {
  plainLanguage: string;
  sections: { heading: string; paragraphs: string[]; bullets?: string[] }[];
  sources?: { label: string; url: string }[];
};
export type PublicPolicy = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  mandatory: boolean;
  version: {
    id: string;
    number: number;
    content: PolicyContent;
    checksum: string;
    revisionNote: string;
    materialChange: boolean;
    effectiveAt: string | null;
    publishedAt: string | null;
  };
};

export function PolicyCenter({ initialSlug }: { initialSlug?: string }) {
  const [policies, setPolicies] = useState<PublicPolicy[]>([]);
  const [selectedSlug, setSelectedSlug] = useState(initialSlug || "");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void fetch("/api/policies")
      .then((response) => response.json())
      .then((payload) => {
        setPolicies(payload.policies || []);
        setSelectedSlug((value) => value || payload.policies?.[0]?.slug || "");
      })
      .finally(() => setLoading(false));
  }, []);
  const filtered = useMemo(
    () =>
      policies.filter((policy) =>
        `${policy.title} ${policy.summary}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [policies, search],
  );
  const selected =
    policies.find((policy) => policy.slug === selectedSlug) || policies[0];
  if (loading)
    return (
      <div className={styles.loading}>Preparing institutional records…</div>
    );
  if (!selected)
    return (
      <section className={styles.pending}>
        <span>LEGAL REVIEW WORKSPACE</span>
        <h1>Policy publication is being prepared.</h1>
        <p>
          The eight-document policy bundle remains in draft until the owner
          records qualified legal review and trademark clearance. Admissions
          signing is paused until publication.
        </p>
        <Link href="/">Return to Enfusion University</Link>
      </section>
    );
  return (
    <div className={styles.center}>
      <aside className={styles.index}>
        <Link href="/" className={styles.wordmark}>
          ENFUSION <small>UNIVERSITY</small>
        </Link>
        <span>INSTITUTIONAL POLICY CENTER</span>
        <h1>Policies, rights, and academic terms</h1>
        <p>
          Published records jointly operated by Thunder Buddies Studios and
          Black Ridge Studios.
        </p>
        <label>
          Search policies
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search titles and summaries"
          />
        </label>
        <nav aria-label="Policy documents">
          {filtered.map((policy, index) => (
            <button
              key={policy.id}
              className={policy.slug === selected.slug ? styles.active : ""}
              onClick={() => setSelectedSlug(policy.slug)}
            >
              <i>{String(index + 1).padStart(2, "0")}</i>
              <span>
                {policy.title}
                <small>Version {policy.version.number}</small>
              </span>
            </button>
          ))}
        </nav>
        <div className={styles.actions}>
          <Link href="/policies/accept">Review and sign</Link>
          <button onClick={() => window.print()}>Print current document</button>
        </div>
      </aside>
      <article className={styles.document} id="policy-document">
        <header>
          <span>
            OFFICIAL INSTITUTIONAL RECORD · VERSION {selected.version.number}
          </span>
          <h2>{selected.title}</h2>
          <p>{selected.summary}</p>
          <dl>
            <div>
              <dt>Effective</dt>
              <dd>
                {selected.version.effectiveAt
                  ? new Date(selected.version.effectiveAt).toLocaleDateString()
                  : "Upon publication"}
              </dd>
            </div>
            <div>
              <dt>Revision</dt>
              <dd>{selected.version.revisionNote}</dd>
            </div>
            <div>
              <dt>Checksum</dt>
              <dd>{selected.version.checksum.slice(0, 16)}…</dd>
            </div>
          </dl>
        </header>
        <section className={styles.plain}>
          <span>PLAIN-LANGUAGE SUMMARY</span>
          <p>{selected.version.content.plainLanguage}</p>
        </section>
        {selected.version.content.sections.map((section, index) => (
          <section className={styles.policySection} key={section.heading}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h3>{section.heading}</h3>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets && (
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ))}
        {selected.version.content.sources && (
          <section className={styles.sources}>
            <h3>Official references</h3>
            {selected.version.content.sources.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                {source.label} ↗
              </a>
            ))}
          </section>
        )}
        <footer>
          <p>
            Questions, accessibility requests, privacy requests, and formal
            notices are handled through the university policy contact system.
            Owner email addresses are not published.
          </p>
          <Link href="/policies/contact">Contact the policy office</Link>
        </footer>
      </article>
    </div>
  );
}
