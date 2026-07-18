"use client";

import { useState } from "react";
import type { PublicPolicy } from "./PolicyCenter";
import styles from "./InlinePolicyReview.module.css";

export function InlinePolicyReview({
  policy,
  index,
  reviewed,
  acknowledged,
  onReview,
  onAcknowledged,
  inputName,
  required = false,
}: {
  policy: PublicPolicy;
  index: number;
  reviewed: boolean;
  acknowledged: boolean;
  onReview: () => void;
  onAcknowledged: (value: boolean) => void;
  inputName?: string;
  required?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  function toggle() {
    const next = !expanded;
    if (next && !reviewed) onReview();
    setExpanded(next);
  }
  return (
    <article className={styles.policy} data-expanded={expanded}>
      <button
        className={styles.summary}
        type="button"
        aria-expanded={expanded}
        aria-controls={`inline-policy-${policy.version.id}`}
        onClick={toggle}
      >
        <i>{String(index + 1).padStart(2, "0")}</i>
        <span>
          <small>
            VERSION {policy.version.number} ·{" "}
            {policy.version.materialChange
              ? "MATERIAL POLICY"
              : "CURRENT POLICY"}
          </small>
          <b>{policy.title}</b>
          <em>{policy.summary}</em>
        </span>
        <strong>
          {expanded ? "CLOSE" : "READ POLICY"}
          <i aria-hidden="true">⌄</i>
        </strong>
      </button>
      {expanded && (
        <div
          className={styles.document}
          id={`inline-policy-${policy.version.id}`}
        >
          <header>
            <span>PLAIN-LANGUAGE SUMMARY</span>
            <p>{policy.version.content.plainLanguage}</p>
          </header>
          {policy.version.content.sections.map((section, sectionIndex) => (
            <section key={section.heading}>
              <i>{String(sectionIndex + 1).padStart(2, "0")}</i>
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
          {!!policy.version.content.sources?.length && (
            <footer>
              <b>OFFICIAL REFERENCES</b>
              {policy.version.content.sources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.label} ↗
                </a>
              ))}
            </footer>
          )}
          <dl>
            <div>
              <dt>Effective</dt>
              <dd>
                {policy.version.effectiveAt
                  ? new Date(policy.version.effectiveAt).toLocaleDateString()
                  : "Upon publication"}
              </dd>
            </div>
            <div>
              <dt>Revision</dt>
              <dd>{policy.version.revisionNote}</dd>
            </div>
            <div>
              <dt>Checksum</dt>
              <dd>{policy.version.checksum}</dd>
            </div>
          </dl>
        </div>
      )}
      <label className={styles.acknowledge}>
        <input
          name={inputName}
          type="checkbox"
          required={required}
          disabled={!reviewed}
          checked={acknowledged}
          onChange={(event) => onAcknowledged(event.target.checked)}
        />
        <span>
          {reviewed
            ? `I acknowledge ${policy.title}, version ${policy.version.number}.`
            : "Expand and read this policy before acknowledging it."}
        </span>
      </label>
    </article>
  );
}
