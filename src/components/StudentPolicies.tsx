"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./StudentPolicies.module.css";
import { AcademicLoader } from "./AcademicLoader";

type Data = {
  policyCompliant: boolean;
  bundlePublished: boolean;
  bundleStatus:
    | "AWAITING_PUBLICATION"
    | "AWAITING_ACTIVATION"
    | "CURRENT"
    | "ACTION_REQUIRED";
  documentsSeeded: number;
  gateActive: boolean;
  missingPolicyVersions: { title: string; version: number }[];
  policies: {
    slug: string;
    title: string;
    version: { number: number; checksum: string };
  }[];
  history: {
    id: string;
    title: string;
    version: number;
    materialChange: boolean;
    revisionNote: string;
    checksum: string;
  }[];
  signatures: {
    id: string;
    receiptNumber: string;
    signedAt: string;
    policies: { title: string; version: number }[];
  }[];
  inquiries: {
    trackingNumber: string;
    category: string;
    subject: string;
    status: string;
  }[];
};

export function StudentPolicies() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(
      () =>
        void fetch("/api/university/policies", { cache: "no-store" })
          .then(async (response) => {
            const result = await response.json();
            if (!response.ok)
              throw new Error(
                result.error || "Policy records could not be loaded.",
              );
            setData(result);
          })
          .catch((reason) =>
            setError(
              reason instanceof Error
                ? reason.message
                : "Policy records could not be loaded.",
            ),
          ),
      0,
    );
    return () => clearTimeout(timer);
  }, []);

  async function close() {
    if (
      !window.confirm(
        "This disables campus access, hides credentials, and deletes eligible optional messages. Core records remain for seven years. Continue?",
      )
    )
      return;
    const confirmation = window.prompt('Type "CLOSE MY ACCOUNT" to confirm.');
    if (!confirmation) return;
    setClosing(true);
    const response = await fetch("/api/university/account-closure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });
    const result = await response.json();
    if (response.ok) window.location.href = result.redirectUrl;
    else {
      alert(result.error);
      setClosing(false);
    }
  }

  if (!data)
    return (
      <AcademicLoader
        label={error || "Loading policy records"}
        error={Boolean(error)}
      />
    );
  const status =
    data.bundleStatus === "CURRENT"
      ? {
          label: "CURRENT",
          message: "Every mandatory material version is signed.",
        }
      : data.bundleStatus === "ACTION_REQUIRED"
        ? {
            label: "ACTION REQUIRED",
            message: `${data.missingPolicyVersions.length} policy versions require your signature.`,
          }
        : data.bundleStatus === "AWAITING_ACTIVATION"
          ? {
              label: "AWAITING ACTIVATION",
              message:
                "The initial bundle is published but the institutional consent gate is not active.",
            }
          : {
              label: "AWAITING PUBLICATION",
              message: `${data.documentsSeeded} policy drafts are in owner legal and trademark review. No policy signature is currently due.`,
            };

  return (
    <section className={styles.page}>
      <header>
        <span>POLICIES & AGREEMENTS</span>
        <h1>Your institutional record</h1>
        <p>
          Review current obligations, preserve signed receipts, and contact the
          policy office without leaving Student Center.
        </p>
        <div className={data.policyCompliant ? styles.good : styles.action}>
          <b>{status.label}</b>
          <span>{status.message}</span>
          {data.bundleStatus === "ACTION_REQUIRED" && (
            <Link href="/policies/accept">Review and sign now</Link>
          )}
        </div>
      </header>
      <div className={styles.grid}>
        <article>
          <h2>Current policy bundle</h2>
          {!data.bundlePublished && (
            <div className={styles.record}>
              <span>PRE-PUBLICATION REVIEW</span>
              <b>No policy version is effective yet.</b>
              <small>
                The owner must publish the legally and trademark-reviewed
                initial bundle in Owner Access → Policy Administration. Drafts
                are not represented as binding student agreements before that
                confirmation.
              </small>
            </div>
          )}
          {data.policies.map((policy) => (
            <Link key={policy.slug} href={`/policies/${policy.slug}`}>
              <span>{policy.title}</span>
              <small>
                Version {policy.version.number} ·{" "}
                {policy.version.checksum.slice(0, 12)}…
              </small>
            </Link>
          ))}
          {data.history.length > 0 && (
            <details>
              <summary>Prior published versions</summary>
              {data.history.map((version) => (
                <div className={styles.record} key={version.id}>
                  <span>
                    {version.materialChange ? "MATERIAL" : "NONMATERIAL"} ·
                    VERSION {version.version}
                  </span>
                  <b>{version.title}</b>
                  <small>
                    {version.revisionNote} · {version.checksum.slice(0, 12)}…
                  </small>
                </div>
              ))}
            </details>
          )}
        </article>
        <article>
          <h2>Signed receipts</h2>
          {data.signatures.length === 0 ? (
            <p>No electronic signature events are recorded yet.</p>
          ) : (
            data.signatures.map((signature) => (
              <div className={styles.record} key={signature.id}>
                <span>{new Date(signature.signedAt).toLocaleString()}</span>
                <b>{signature.receiptNumber}</b>
                <small>{signature.policies.length} exact policy versions</small>
                <Link href={`/policies/receipts/${signature.id}`}>
                  Open retainable receipt
                </Link>
              </div>
            ))
          )}
        </article>
        <article>
          <h2>Policy inquiries</h2>
          {data.inquiries.length === 0 ? (
            <p>No policy inquiries are open.</p>
          ) : (
            data.inquiries.map((inquiry) => (
              <div className={styles.record} key={inquiry.trackingNumber}>
                <span>
                  {inquiry.status} · {inquiry.category.replaceAll("_", " ")}
                </span>
                <b>{inquiry.subject}</b>
                <small>{inquiry.trackingNumber}</small>
              </div>
            ))
          )}
          <Link className={styles.primary} href="/policies/contact">
            Create policy inquiry
          </Link>
        </article>
        <article>
          <h2>Privacy and account controls</h2>
          <p>
            Request access or correction through the contact system. Account
            closure hides credentials and deletes eligible optional content.
            Consent, academic, ledger, integrity, credential, and audit records
            are retained for seven years.
          </p>
          <Link href="/policies/contact">Start a privacy request</Link>
          <button onClick={close} disabled={closing}>
            {closing ? "CLOSING…" : "REQUEST ACCOUNT CLOSURE"}
          </button>
        </article>
      </div>
    </section>
  );
}
