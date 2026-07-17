import crypto from "node:crypto";

export function createTrackingNumber(type: "ADMISSION" | "PROGRAM") {
  const prefix = type === "ADMISSION" ? "ADM" : "PRG";
  return `EFU-${prefix}-${new Date().getUTCFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export function trackingEvent(status: string, detail?: string) {
  return { status, detail: detail || null, at: new Date().toISOString() };
}
