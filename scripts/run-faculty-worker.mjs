const base = (
  process.env.APP_ORIGIN ||
  process.env.APP_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : "")
).replace(/\/$/, "");
const secret = process.env.FACULTY_MESSAGING_WORKER_SECRET;
if (!base || !secret)
  throw new Error(
    "APP_ORIGIN/APP_URL/RAILWAY_PUBLIC_DOMAIN and FACULTY_MESSAGING_WORKER_SECRET are required",
  );
const idlePollMs = Math.max(
  2_000,
  Math.min(60_000, Number(process.env.FACULTY_WORKER_POLL_MS || 8_000)),
);
let consecutiveFailures = 0;
for (;;) {
  try {
    const response = await fetch(`${base}/api/internal/faculty-messaging`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(70_000),
    });
    if (!response.ok)
      throw new Error(`Faculty worker failed (${response.status})`);
    const result = await response.json();
    consecutiveFailures = 0;
    if (!result.processed)
      await new Promise((resolve) => setTimeout(resolve, idlePollMs));
  } catch (error) {
    consecutiveFailures++;
    console.error(
      error instanceof Error ? error.message : "Faculty worker request failed",
    );
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.min(60_000, idlePollMs * Math.max(1, consecutiveFailures)),
      ),
    );
  }
}
