"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./StudentPolicies.module.css";

type Data = {
  policyCompliant: boolean;
  gateActive: boolean;
  missingPolicyVersions: { title: string; version: number }[];
  policies: { slug: string; title: string; version: { number: number; checksum: string } }[];
  history: { id: string; title: string; version: number; materialChange: boolean; revisionNote: string; checksum: string }[];
  signatures: { id: string; receiptNumber: string; signedAt: string; policies: { title: string; version: number }[] }[];
  inquiries: { trackingNumber: string; category: string; subject: string; status: string }[];
};

export function StudentPolicies() {
  const [data, setData] = useState<Data | null>(null);
  const [closing, setClosing] = useState(false);
  useEffect(() => { void fetch("/api/university/policies").then((response) => response.json()).then(setData); }, []);
  async function close() {
    if (!window.confirm("This disables campus access, hides credentials, and deletes eligible optional messages. Core records remain for seven years. Continue?")) return;
    const confirmation = window.prompt('Type "CLOSE MY ACCOUNT" to confirm.');
    if (!confirmation) return;
    setClosing(true);
    const response = await fetch("/api/university/account-closure", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmation }) });
    const result = await response.json();
    if (response.ok) window.location.href = result.redirectUrl;
    else { alert(result.error); setClosing(false); }
  }
  if (!data) return <p>Loading policy records…</p>;
  return <section className={styles.page}>
    <header><span>POLICIES & AGREEMENTS</span><h1>Your institutional record</h1><p>Review current obligations, preserve signed receipts, and contact the policy office without leaving Student Center.</p><div className={data.policyCompliant ? styles.good : styles.action}><b>{data.policyCompliant ? "CURRENT" : "ACTION REQUIRED"}</b><span>{data.policyCompliant ? "Every mandatory material version is signed." : `${data.missingPolicyVersions.length} policy versions require your signature.`}</span>{!data.policyCompliant && <Link href="/policies/accept">Review and sign now</Link>}</div></header>
    <div className={styles.grid}>
      <article><h2>Current policy bundle</h2>{data.policies.map((policy) => <Link key={policy.slug} href={`/policies/${policy.slug}`}><span>{policy.title}</span><small>Version {policy.version.number} · {policy.version.checksum.slice(0, 12)}…</small></Link>)}<details><summary>Prior published versions</summary>{data.history.map((version) => <div className={styles.record} key={version.id}><span>{version.materialChange ? "MATERIAL" : "NONMATERIAL"} · VERSION {version.version}</span><b>{version.title}</b><small>{version.revisionNote} · {version.checksum.slice(0, 12)}…</small></div>)}</details></article>
      <article><h2>Signed receipts</h2>{data.signatures.length === 0 ? <p>No electronic signature events are recorded yet.</p> : data.signatures.map((signature) => <div className={styles.record} key={signature.id}><span>{new Date(signature.signedAt).toLocaleString()}</span><b>{signature.receiptNumber}</b><small>{signature.policies.length} exact policy versions</small><Link href={`/policies/receipts/${signature.id}`}>Open retainable receipt</Link></div>)}</article>
      <article><h2>Policy inquiries</h2>{data.inquiries.length === 0 ? <p>No policy inquiries are open.</p> : data.inquiries.map((inquiry) => <div className={styles.record} key={inquiry.trackingNumber}><span>{inquiry.status} · {inquiry.category.replaceAll("_", " ")}</span><b>{inquiry.subject}</b><small>{inquiry.trackingNumber}</small></div>)}<Link className={styles.primary} href="/policies/contact">Create policy inquiry</Link></article>
      <article><h2>Privacy and account controls</h2><p>Request access or correction through the contact system. Account closure hides credentials and deletes eligible optional content. Consent, academic, ledger, integrity, credential, and audit records are retained for seven years.</p><Link href="/policies/contact">Start a privacy request</Link><button onClick={close} disabled={closing}>{closing ? "CLOSING…" : "REQUEST ACCOUNT CLOSURE"}</button></article>
    </div>
  </section>;
}
