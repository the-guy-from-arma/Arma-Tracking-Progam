const secret = process.env.WIKI_SYNC_SECRET || "";
const publicDomain = process.env.RAILWAY_PUBLIC_DOMAIN || "";
const baseUrl = (process.env.APP_URL || (publicDomain ? `https://${publicDomain}` : "")).replace(/\/$/, "");
if (!baseUrl || !secret) throw new Error("APP_URL (or RAILWAY_PUBLIC_DOMAIN) and WIKI_SYNC_SECRET are required");
const response = await fetch(`${baseUrl}/api/admin/curriculum/sync`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
const result = await response.text();
if (!response.ok) throw new Error(`Curriculum sync failed (${response.status}): ${result}`);
console.log(`[curriculum] ${result}`);
