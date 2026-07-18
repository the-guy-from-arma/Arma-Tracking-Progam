const base = (process.env.APP_ORIGIN || process.env.APP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "")).replace(/\/$/, "");
const secret = process.env.FACULTY_OUTREACH_SECRET;
if (!base || !secret) throw new Error("APP_ORIGIN/APP_URL/RAILWAY_PUBLIC_DOMAIN and FACULTY_OUTREACH_SECRET are required");
const response = await fetch(`${base}/api/internal/faculty-outreach`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
if (!response.ok) throw new Error(`Faculty outreach failed (${response.status})`);
console.log(await response.json());
