"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { InlinePolicyReview } from "./InlinePolicyReview";
import type { PublicPolicy } from "./PolicyCenter";
import styles from "./PolicyAcceptance.module.css";

export function PolicyAcceptance() {
  const [policies, setPolicies] = useState<PublicPolicy[]>([]);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [age, setAge] = useState(false);
  const [bundleAccepted, setBundleAccepted] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [returnTo, setReturnTo] = useState("/university");
  const [receipt, setReceipt] = useState<{
    signatureEventId: string;
    receiptNumber: string;
  } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const requestedReturn = new URLSearchParams(window.location.search).get(
        "returnTo",
      );
      if (
        requestedReturn?.startsWith("/university") ||
        requestedReturn === "/admissions/status"
      )
        setReturnTo(requestedReturn);
      void fetch("/api/policies")
        .then((response) => response.json())
        .then((payload) => setPolicies(payload.policies || []));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function sign() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/policies/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        policyVersionIds: policies.map((policy) => policy.version.id),
        bundleAccepted,
        signerName: name,
        ageAttested: age,
        electronicConsent: consent,
      }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(result.error || "The policy bundle could not be signed.");
      if (result.code === "POLICY_VERSION_CHANGED") {
        setReviewed([]);
      }
      return;
    }
    setReceipt(result);
  }

  if (receipt)
    return (
      <main className={styles.complete}>
        <span>ELECTRONIC RECORD COMPLETE</span>
        <h1>Your campus access is active.</h1>
        <p>
          Receipt {receipt.receiptNumber} preserves the exact documents,
          versions, checksums, signer, and timestamp.
        </p>
        <div>
          <Link href={`/policies/receipts/${receipt.signatureEventId}`}>
            View signed receipt
          </Link>
          <Link href={returnTo}>
            {returnTo.includes("view=messages")
              ? "Return to Campus Messages"
              : returnTo === "/admissions/status"
                ? "Return to Application Status"
              : "Enter Student Campus"}
          </Link>
        </div>
      </main>
    );

  return (
    <main className={styles.page}>
      <header>
        <Link href="/">ENSCRIPT UNIVERSITY</Link>
        <span>POLICY ACCEPTANCE</span>
      </header>
      <div className={styles.layout}>
        <section className={styles.intro}>
          <span>RE-CONSENT GATE</span>
          <h1>
            Read here.
            <br />
            Sign the exact record.
          </h1>
          <p>
            Every policy expands inside this page. Campus sign-in remains
            available, but academic activity is paused until every current
            mandatory bundle is accepted.
          </p>
          <ul>
            <li>Review the complete policy bundle in place</li>
            <li>Accept all listed versions with one clear attestation</li>
            <li>Attest that you are at least 18</li>
            <li>Type your account name and consent to electronic records</li>
          </ul>
        </section>
        <section className={styles.form}>
          <h2>Required policy bundle</h2>
          <p className={styles.instructions}>
            Select <b>Read policy</b> to expand the complete document below its
            title. Opening each document is encouraged and remembered, but
            eight repetitive checkboxes are no longer required.
          </p>
          <div className={styles.policyList}>
            {policies.map((policy, index) => {
              const opened = reviewed.includes(policy.version.id);
              return (
                <InlinePolicyReview
                  key={policy.id}
                  policy={policy}
                  index={index}
                  reviewed={opened}
                  acknowledged={false}
                  showAcknowledgement={false}
                  onReview={() =>
                    setReviewed((current) =>
                      current.includes(policy.version.id)
                        ? current
                        : [...current, policy.version.id],
                    )
                  }
                  onAcknowledged={() => {}}
                />
              );
            })}
          </div>
          <div className={styles.signature}>
            <label>
              <input
                type="checkbox"
                checked={age}
                onChange={(event) => setAge(event.target.checked)}
              />
              I attest that I am at least 18 years old.
            </label>
            <label>
              <input
                type="checkbox"
                checked={bundleAccepted}
                onChange={(event) => setBundleAccepted(event.target.checked)}
              />
              I accept every policy title, version, effective date, and
              checksum listed in this complete bundle.
            </label>
            <label>
              Typed electronic signature
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter the name on your account"
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />
              I consent to electronic records and intend to sign.
            </label>
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button
            onClick={sign}
            disabled={
              busy ||
              policies.length !== 8 ||
              !age ||
              !bundleAccepted ||
              !consent ||
              name.trim().length < 2
            }
          >
            {busy ? "RECORDING SIGNATURE…" : "SIGN CURRENT POLICY BUNDLE"}
          </button>
          <small className={styles.legal}>
            You may print every document before signing. Withdrawing electronic
            consent closes online access because Enscript University is
            online-only.
          </small>
        </section>
      </div>
    </main>
  );
}
