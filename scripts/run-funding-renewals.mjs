const origin = process.env.APP_ORIGIN || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "http://localhost:3000");
const secret = process.env.FUNDING_RENEWAL_SECRET;
if (!secret) throw new Error("FUNDING_RENEWAL_SECRET is required");
const response = await fetch(`${origin}/api/internal/funding-renewals`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
if (!response.ok) throw new Error(`Funding renewal worker failed with ${response.status}`);
console.log(await response.text());
