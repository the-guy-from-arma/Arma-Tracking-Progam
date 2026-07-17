const origin = process.env.APP_ORIGIN || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "http://localhost:3000");
const secret = process.env.AI_GRADING_WORKER_SECRET;
if (!secret) throw new Error("AI_GRADING_WORKER_SECRET is required");
const response = await fetch(`${origin}/api/internal/ai-grading`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
if (!response.ok) throw new Error(`AI grading worker failed with ${response.status}`);
console.log(await response.text());
