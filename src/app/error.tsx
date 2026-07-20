"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ApplicationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("University page error", error);
  }, [error]);

  return (
    <main className="application-error">
      <span>ENSCRIPT UNIVERSITY · CAMPUS RECOVERY</span>
      <h1>This page did not finish loading.</h1>
      <p>
        Your operating change and student records remain protected. Retry the
        live page or return to the campus status screen.
      </p>
      <div>
        <button type="button" onClick={reset}>
          RETRY LIVE PAGE
        </button>
        <Link href="/campus-status">VIEW CAMPUS STATUS</Link>
        <Link href="/">RETURN HOME</Link>
      </div>
    </main>
  );
}
