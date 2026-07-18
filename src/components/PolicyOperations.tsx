"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./PolicyOperations.module.css";

type PolicyContent = {
  plainLanguage?: string;
  sections?: { heading: string; paragraphs: string[]; bullets?: string[] }[];
};
type Version = {
  id: string;
  version: number;
  status: string;
  materialChange: boolean;
  checksum: string;
  revisionNote: string;
  effectiveAt: string | null;
  publishedAt: string | null;
  content: PolicyContent;
};
type Document = {
  id: string;
  slug: string;
  title: string;
  versions: Version[];
};
type Data = {
  setting: { gateActive: boolean; aiDataMode: string };
  documents: Document[];
  students: number;
  studentsWithAnyAcceptance: number;
  outstanding: {
    id: string;
    name: string;
    studentNumber: string | null;
    missing: { title: string; version: number }[];
  }[];
  inquiries: {
    id: string;
    trackingNumber: string;
    category: string;
    subject: string;
    status: string;
    disputeDeadline: string | null;
    messages: { body: string }[];
  }[];
};

export function PolicyOperations() {
  const [data, setData] = useState<Data | null>(null);
  const [legal, setLegal] = useState(false);
  const [trademark, setTrademark] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{
    documentId: string;
    versionId: string;
  } | null>(null);
  const [publishLegal, setPublishLegal] = useState(false);
  const [publishTrademark, setPublishTrademark] = useState(false);
  const load = useCallback(
    () =>
      fetch("/api/admin/policies", { cache: "no-store" })
        .then((response) => response.json())
        .then(setData),
    [],
  );
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function action(payload: Record<string, unknown>) {
    setBusy(true);
    const response = await fetch("/api/admin/policies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) alert(result.error);
    else await load();
    return response.ok;
  }

  const previewRecord = useMemo(() => {
    if (!data || !preview) return null;
    const document = data.documents.find(
      (item) => item.id === preview.documentId,
    );
    const version = document?.versions.find(
      (item) => item.id === preview.versionId,
    );
    if (!document || !version) return null;
    const previous = document.versions.find(
      (item) => item.status === "PUBLISHED" && item.version < version.version,
    );
    return { document, version, previous };
  }, [data, preview]);

  if (!data) return <p>Loading policy administration…</p>;
  return (
    <section className={styles.page}>
      <header>
        <span>OWNER / POLICY ADMINISTRATION</span>
        <h1>Institutional policy control</h1>
        <p>
          Published versions are immutable. Every proposed change must be
          previewed against the currently published record before legal approval
          and publication.
        </p>
      </header>
      <div className={styles.metrics}>
        <div>
          <small>POLICY GATE</small>
          <b>{data.setting.gateActive ? "ACTIVE" : "DRAFT"}</b>
        </div>
        <div>
          <small>DOCUMENTS</small>
          <b>{data.documents.length} / 8</b>
        </div>
        <div>
          <small>STUDENTS WITH RECORDS</small>
          <b>
            {data.studentsWithAnyAcceptance} / {data.students}
          </b>
        </div>
        <div>
          <small>GEMINI DATA MODE</small>
          <b>{data.setting.aiDataMode.replaceAll("_", " ")}</b>
        </div>
      </div>
      {!data.setting.gateActive && (
        <article className={styles.activation}>
          <span>PRE-PUBLICATION CONTROL</span>
          <h2>Legal and trademark clearance required</h2>
          <p>
            Activation publishes all eight version-one drafts and immediately
            starts the admissions and existing-student consent gate.
          </p>
          <label>
            <input
              type="checkbox"
              checked={legal}
              onChange={(event) => setLegal(event.target.checked)}
            />
            Qualified legal counsel reviewed all documents.
          </label>
          <label>
            <input
              type="checkbox"
              checked={trademark}
              onChange={(event) => setTrademark(event.target.checked)}
            />
            The “Enfusion University” name received separate trademark review.
          </label>
          <button
            disabled={busy || !legal || !trademark}
            onClick={() =>
              action({
                action: "activate_initial",
                legalReviewed: legal,
                trademarkReviewed: trademark,
              })
            }
          >
            PUBLISH INITIAL BUNDLE + ACTIVATE GATE
          </button>
        </article>
      )}
      <div className={styles.columns}>
        <article>
          <h2>Version register</h2>
          <p className={styles.sectionLead}>
            Open the proposed version to inspect the exact language, checksum,
            material-change status, and comparison before publication.
          </p>
          {data.documents.map((document) => {
            const latest = document.versions[0];
            return (
              <div className={styles.document} key={document.id}>
                <span>{document.slug}</span>
                <h3>{document.title}</h3>
                <p>
                  Version {latest?.version} · {latest?.status} ·{" "}
                  {latest?.materialChange ? "Material" : "Nonmaterial"}
                </p>
                <code>{latest?.checksum}</code>
                {latest && (
                  <button
                    className={styles.previewButton}
                    onClick={() => {
                      setPreview({
                        documentId: document.id,
                        versionId: latest.id,
                      });
                      setPublishLegal(false);
                      setPublishTrademark(false);
                    }}
                  >
                    PREVIEW{" "}
                    {latest.status === "DRAFT"
                      ? "PROPOSED CHANGE"
                      : "CURRENT VERSION"}
                  </button>
                )}
                {latest?.status !== "DRAFT" && (
                  <button
                    onClick={() =>
                      action({
                        action: "create_version",
                        documentId: document.id,
                        materialChange: true,
                        revisionNote: "Owner-created policy revision",
                      })
                    }
                  >
                    CREATE NEXT DRAFT
                  </button>
                )}
              </div>
            );
          })}
        </article>
        <article>
          <h2>Provider data mode</h2>
          <p>
            A change creates a material AI Notice draft. Preview and publish it
            after legal review to trigger re-consent.
          </p>
          <select
            value={data.setting.aiDataMode}
            onChange={(event) =>
              action({
                action: "set_ai_data_mode",
                aiDataMode: event.target.value,
              })
            }
          >
            <option>UNCONFIRMED_OR_UNPAID</option>
            <option>PAID_SERVICE_CONFIRMED</option>
            <option>AI_DISABLED</option>
          </select>
          <h2>Outstanding re-consent</h2>
          {data.outstanding.length === 0 ? (
            <p>Every active student is current.</p>
          ) : (
            data.outstanding.map((student) => (
              <div className={styles.inquiry} key={student.id}>
                <span>
                  {student.studentNumber || "STUDENT"} ·{" "}
                  {student.missing.length} REQUIRED
                </span>
                <h3>{student.name}</h3>
                <p>
                  {student.missing
                    .map((item) => `${item.title} v${item.version}`)
                    .join(", ")}
                </p>
              </div>
            ))
          )}
          <h2>Policy inquiry queue</h2>
          {data.inquiries.length === 0 ? (
            <p>No inquiries are waiting.</p>
          ) : (
            data.inquiries.map((inquiry) => (
              <div className={styles.inquiry} key={inquiry.id}>
                <span>
                  {inquiry.status} · {inquiry.category.replaceAll("_", " ")}
                </span>
                <h3>{inquiry.subject}</h3>
                <small>
                  {inquiry.trackingNumber}
                  {inquiry.disputeDeadline
                    ? ` · Deadline ${new Date(inquiry.disputeDeadline).toLocaleDateString()}`
                    : ""}
                </small>
                <p>{inquiry.messages.at(-1)?.body}</p>
                <button
                  onClick={() => {
                    const message = window.prompt("Audited owner response");
                    if (message)
                      void action({
                        action: "respond_inquiry",
                        inquiryId: inquiry.id,
                        message,
                        close: false,
                      });
                  }}
                >
                  RESPOND
                </button>
                <button
                  onClick={() => {
                    const message = window.prompt("Final audited response");
                    if (message)
                      void action({
                        action: "respond_inquiry",
                        inquiryId: inquiry.id,
                        message,
                        close: true,
                      });
                  }}
                >
                  RESPOND + RESOLVE
                </button>
              </div>
            ))
          )}
        </article>
      </div>
      {previewRecord && (
        <div
          className={styles.previewBack}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreview(null);
          }}
        >
          <section
            className={styles.preview}
            role="dialog"
            aria-modal="true"
            aria-labelledby="policy-preview-title"
          >
            <header>
              <div>
                <span>POLICY CHANGE REVIEW</span>
                <h2 id="policy-preview-title">
                  {previewRecord.document.title}
                </h2>
                <p>
                  Version {previewRecord.version.version} ·{" "}
                  {previewRecord.version.status} ·{" "}
                  {previewRecord.version.materialChange
                    ? "Material change—student re-consent required"
                    : "Nonmaterial correction"}
                </p>
              </div>
              <button
                aria-label="Close policy preview"
                onClick={() => setPreview(null)}
              >
                ×
              </button>
            </header>
            <div className={styles.previewMeta}>
              <div>
                <small>REVISION NOTE</small>
                <b>{previewRecord.version.revisionNote}</b>
              </div>
              <div>
                <small>PROPOSED CHECKSUM</small>
                <code>{previewRecord.version.checksum}</code>
              </div>
              <div>
                <small>EFFECTIVE</small>
                <b>
                  {previewRecord.version.effectiveAt
                    ? new Date(
                        previewRecord.version.effectiveAt,
                      ).toLocaleString()
                    : "On publication"}
                </b>
              </div>
            </div>
            <div className={styles.comparison}>
              <article>
                <span>
                  CURRENTLY PUBLISHED · VERSION{" "}
                  {previewRecord.previous?.version || "—"}
                </span>
                {previewRecord.previous ? (
                  <PolicyPreviewContent
                    content={previewRecord.previous.content}
                  />
                ) : (
                  <p>No earlier published version exists.</p>
                )}
              </article>
              <article>
                <span>PROPOSED · VERSION {previewRecord.version.version}</span>
                <PolicyPreviewContent content={previewRecord.version.content} />
              </article>
            </div>
            {previewRecord.version.status === "DRAFT" && (
              <footer>
                <div>
                  <label>
                    <input
                      type="checkbox"
                      checked={publishLegal}
                      onChange={(event) =>
                        setPublishLegal(event.target.checked)
                      }
                    />
                    Qualified legal counsel reviewed this exact proposed
                    version.
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={publishTrademark}
                      onChange={(event) =>
                        setPublishTrademark(event.target.checked)
                      }
                    />
                    Trademark review is recorded when applicable.
                  </label>
                </div>
                <button
                  disabled={busy || !publishLegal}
                  onClick={async () => {
                    const ok = await action({
                      action: "publish_version",
                      versionId: previewRecord.version.id,
                      legalReviewed: publishLegal,
                      trademarkReviewed: publishTrademark,
                      effectiveAt: new Date().toISOString(),
                    });
                    if (ok) setPreview(null);
                  }}
                >
                  PUBLISH REVIEWED VERSION
                </button>
              </footer>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function PolicyPreviewContent({ content }: { content: PolicyContent }) {
  return (
    <div className={styles.previewContent}>
      {content.plainLanguage && (
        <p className={styles.previewSummary}>{content.plainLanguage}</p>
      )}
      {content.sections?.map((section) => (
        <section key={section.heading}>
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
        </section>
      ))}
    </div>
  );
}
