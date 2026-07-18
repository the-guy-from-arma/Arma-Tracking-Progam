"use client";
import { useCallback, useEffect, useState } from "react";
import styles from "./PolicyOperations.module.css";

type Data = {
  setting: { gateActive: boolean; aiDataMode: string };
  documents: { id: string; slug: string; title: string; versions: { id: string; version: number; status: string; materialChange: boolean; checksum: string }[] }[];
  students: number;
  studentsWithAnyAcceptance: number;
  outstanding: { id: string; name: string; studentNumber: string | null; missing: { title: string; version: number }[] }[];
  inquiries: { id: string; trackingNumber: string; category: string; subject: string; status: string; disputeDeadline: string | null; messages: { body: string }[] }[];
};

export function PolicyOperations() {
  const [data, setData] = useState<Data | null>(null);
  const [legal, setLegal] = useState(false);
  const [trademark, setTrademark] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => fetch("/api/admin/policies").then((response) => response.json()).then(setData), []);
  useEffect(() => { void load(); }, [load]);
  async function action(payload: Record<string, unknown>) {
    setBusy(true);
    const response = await fetch("/api/admin/policies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json(); setBusy(false);
    if (!response.ok) alert(result.error); else await load();
  }
  if (!data) return <p>Loading policy administration…</p>;
  return <section className={styles.page}>
    <header><span>OWNER / POLICY ADMINISTRATION</span><h1>Institutional policy control</h1><p>Published versions are immutable. Corrections require a new version, legal review, checksum, and audited publication event.</p></header>
    <div className={styles.metrics}><div><small>POLICY GATE</small><b>{data.setting.gateActive ? "ACTIVE" : "DRAFT"}</b></div><div><small>DOCUMENTS</small><b>{data.documents.length} / 8</b></div><div><small>STUDENTS WITH RECORDS</small><b>{data.studentsWithAnyAcceptance} / {data.students}</b></div><div><small>GEMINI DATA MODE</small><b>{data.setting.aiDataMode.replaceAll("_", " ")}</b></div></div>
    {!data.setting.gateActive && <article className={styles.activation}><span>PRE-PUBLICATION CONTROL</span><h2>Legal and trademark clearance required</h2><p>Activation publishes all eight version-one drafts and immediately starts the admissions and existing-student consent gate.</p><label><input type="checkbox" checked={legal} onChange={(event) => setLegal(event.target.checked)} />Qualified legal counsel reviewed all documents.</label><label><input type="checkbox" checked={trademark} onChange={(event) => setTrademark(event.target.checked)} />The “Enfusion University” name received separate trademark review.</label><button disabled={busy || !legal || !trademark} onClick={() => action({ action: "activate_initial", legalReviewed: legal, trademarkReviewed: trademark })}>PUBLISH INITIAL BUNDLE + ACTIVATE GATE</button></article>}
    <div className={styles.columns}>
      <article><h2>Version register</h2>{data.documents.map((document) => { const latest = document.versions[0]; return <div className={styles.document} key={document.id}><span>{document.slug}</span><h3>{document.title}</h3><p>Version {latest?.version} · {latest?.status} · {latest?.materialChange ? "Material" : "Nonmaterial"}</p><code>{latest?.checksum}</code><button onClick={() => action({ action: "create_version", documentId: document.id, materialChange: true, revisionNote: "Owner-created policy revision" })}>CREATE NEXT DRAFT</button>{latest?.status === "DRAFT" && latest.version > 1 && <button onClick={() => action({ action: "publish_version", versionId: latest.id, legalReviewed: true, effectiveAt: new Date().toISOString() })}>PUBLISH REVIEWED DRAFT</button>}</div>; })}</article>
      <article><h2>Provider data mode</h2><p>A change creates a material AI Notice draft. Publish it after legal review to trigger re-consent.</p><select value={data.setting.aiDataMode} onChange={(event) => action({ action: "set_ai_data_mode", aiDataMode: event.target.value })}><option>UNCONFIRMED_OR_UNPAID</option><option>PAID_SERVICE_CONFIRMED</option><option>AI_DISABLED</option></select><h2>Outstanding re-consent</h2>{data.outstanding.length === 0 ? <p>Every active student is current.</p> : data.outstanding.map((student) => <div className={styles.inquiry} key={student.id}><span>{student.studentNumber || "STUDENT"} · {student.missing.length} REQUIRED</span><h3>{student.name}</h3><p>{student.missing.map((item) => `${item.title} v${item.version}`).join(", ")}</p></div>)}<h2>Policy inquiry queue</h2>{data.inquiries.length === 0 ? <p>No inquiries are waiting.</p> : data.inquiries.map((inquiry) => <div className={styles.inquiry} key={inquiry.id}><span>{inquiry.status} · {inquiry.category.replaceAll("_", " ")}</span><h3>{inquiry.subject}</h3><small>{inquiry.trackingNumber}{inquiry.disputeDeadline ? ` · Deadline ${new Date(inquiry.disputeDeadline).toLocaleDateString()}` : ""}</small><p>{inquiry.messages.at(-1)?.body}</p><button onClick={() => { const message = window.prompt("Audited owner response"); if (message) void action({ action: "respond_inquiry", inquiryId: inquiry.id, message, close: false }); }}>RESPOND</button><button onClick={() => { const message = window.prompt("Final audited response"); if (message) void action({ action: "respond_inquiry", inquiryId: inquiry.id, message, close: true }); }}>RESPOND + RESOLVE</button></div>)}</article>
    </div>
  </section>;
}
