const base = (
  process.env.APP_ORIGIN ||
  process.env.APP_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "")
).replace(/\/$/, "");
const secret = process.env.ADMISSIONS_WORKER_SECRET;
if (!base || !secret) throw new Error("APP_ORIGIN/APP_URL/RAILWAY_PUBLIC_DOMAIN and ADMISSIONS_WORKER_SECRET are required");
const pollMs = Math.max(2_000, Math.min(60_000, Number(process.env.ADMISSIONS_WORKER_POLL_MS || 8_000)));
let failures = 0;
for (;;) {
  try {
    const response = await fetch(`${base}/api/internal/admissions-review`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(70_000),
    });
    if (!response.ok) throw new Error(`Admissions worker failed (${response.status})`);
    const result = await response.json();
    failures = 0;
    if (!result.processed) await new Promise((resolve) => setTimeout(resolve, pollMs));
  } catch (error) {
    failures += 1;
    console.error(error instanceof Error ? error.message : "Admissions worker request failed");
    await new Promise((resolve) => setTimeout(resolve, Math.min(60_000, pollMs * Math.max(1, failures))));
  }
}
