import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

function configured(value: string | undefined) { return Boolean(value && !value.startsWith("replace-with")); }

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user || user.role !== "OWNER") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";
  const keyConfigured = configured(apiKey);
  const workerConfigured = configured(process.env.AI_GRADING_WORKER_SECRET);
  const enabled = process.env.AI_GRADING_ENABLED === "true";
  const shouldTest = new URL(request.url).searchParams.get("test") === "1";
  let connected: boolean | null = null;
  let connectionMessage = keyConfigured ? "Configuration detected. Run a live test to verify authorization and model access." : "GEMINI_API_KEY is missing from the Railway service.";
  if (shouldTest && keyConfigured) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`, { headers: { "x-goog-api-key": apiKey! }, signal: AbortSignal.timeout(12_000), cache: "no-store" });
      connected = response.ok;
      connectionMessage = response.ok ? "Gemini authorization and model access verified." : `Gemini returned status ${response.status}. Check the key, API access, and model name.`;
    } catch {
      connected = false;
      connectionMessage = "The server could not reach Gemini. The saved key was not exposed.";
    }
  }
  return NextResponse.json({
    model,
    enabled,
    keyConfigured,
    workerConfigured,
    connected,
    connectionMessage,
    confidenceThreshold: Number(process.env.AI_GRADING_CONFIDENCE_THRESHOLD || 0.85),
    maxRetries: Number(process.env.AI_GRADING_MAX_RETRIES || 3),
    ready: keyConfigured && workerConfigured && enabled,
  });
}
