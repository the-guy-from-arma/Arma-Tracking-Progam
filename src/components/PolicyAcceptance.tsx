"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { InlinePolicyReview } from "./InlinePolicyReview";
import type { PublicPolicy } from "./PolicyCenter";
import styles from "./PolicyAcceptance.module.css";

export function PolicyAcceptance() {
  const [policies, setPolicies] = useState<PublicPolicy[]>([]);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [age, setAge] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{
    signatureEventId: string;
    receiptNumber: string;
  } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
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
        policyVersionIds: checked,
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
        setChecked([]);
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
          <Link href="/university">Enter Student Campus</Link>
        </div>
      </main>
    );

  return (
    <main className={styles.page}>
      <header>
        <Link href="/">ENFUSION UNIVERSITY</Link>
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
            mandatory document is reviewed and accepted.
          </p>
          <ul>
            <li>Expand and read every required policy</li>
            <li>Acknowledge each exact version in place</li>
            <li>Attest that you are at least 18</li>
            <li>Type your account name and consent to electronic records</li>
          </ul>
        </section>
        <section className={styles.form}>
          <h2>Required policy bundle</h2>
          <p className={styles.instructions}>
            Select <b>Read policy</b> to expand the complete document below its
            title. The acknowledgment unlocks after the document is opened.
          </p>
          <div className={styles.policyList}>
            {policies.map((policy, index) => {
              const opened = reviewed.includes(policy.version.id);
              const accepted = checked.includes(policy.version.id);
              return (
                <InlinePolicyReview
                  key={policy.id}
                  policy={policy}
                  index={index}
                  reviewed={opened}
                  acknowledged={accepted}
                  onReview={() =>
                    setReviewed((current) =>
                      current.includes(policy.version.id)
                        ? current
                        : [...current, policy.version.id],
                    )
                  }
                  onAcknowledged={(value) =>
                    setChecked((current) =>
                      value
                        ? current.includes(policy.version.id)
                          ? current
                          : [...current, policy.version.id]
                        : current.filter((id) => id !== policy.version.id),
                    )
                  }
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
              checked.length !== policies.length ||
              !age ||
              !consent ||
              name.trim().length < 2
            }
          >
            {busy ? "RECORDING SIGNATURE…" : "SIGN CURRENT POLICY BUNDLE"}
          </button>
          <small className={styles.legal}>
            You may print every document before signing. Withdrawing electronic
            consent closes online access because Enfusion University is
            online-only.
          </small>
        </section>
      </div>
    </main>
  );
}
