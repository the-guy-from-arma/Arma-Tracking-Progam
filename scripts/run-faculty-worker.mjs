const base = (process.env.APP_ORIGIN || process.env.APP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "")).replace(/\/$/, "");
const secret = process.env.FACULTY_MESSAGING_WORKER_SECRET;
if (!base || !secret) throw new Error("APP_ORIGIN/APP_URL/RAILWAY_PUBLIC_DOMAIN and FACULTY_MESSAGING_WORKER_SECRET are required");
for (let index = 0; index < 100; index++) {
  const response = await fetch(`${base}/api/internal/faculty-messaging`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
  if (!response.ok) throw new Error(`Faculty worker failed (${response.status})`);
  const result = await response.json();
  if (!result.processed) break;
}
