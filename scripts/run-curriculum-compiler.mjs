const secret = process.env.CURRICULUM_COMPILER_WORKER_SECRET || "";
const publicDomain = process.env.RAILWAY_PUBLIC_DOMAIN || "";
const baseUrl = (process.env.APP_URL || (publicDomain ? `https://${publicDomain}` : "")).replace(/\/$/, "");
if (!baseUrl || secret.length < 32) throw new Error("APP_URL (or RAILWAY_PUBLIC_DOMAIN) and CURRICULUM_COMPILER_WORKER_SECRET (32+ characters) are required");
const response = await fetch(`${baseUrl}/api/internal/curriculum-compiler`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
const result = await response.text();
if (!response.ok) throw new Error(`Curriculum compiler failed (${response.status}): ${result}`);
console.log(`[curriculum-compiler] ${result}`);
