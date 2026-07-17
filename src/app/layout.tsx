import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { PwaInstall } from "@/components/PwaInstall";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const image = `${origin}/og.png`;
  return { title: { default: "VALORIS Network", template: "%s · VALORIS Network" }, description: "Choose Project VALORIS for professional Arma development or Enfusion University for structured online learning and learner records.", applicationName: "VALORIS Network", manifest: "/manifest.webmanifest", appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "VALORIS" }, icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" }, openGraph: { title: "Project VALORIS + Enfusion University", description: "One secure network for Arma development knowledge, source-grounded learning, assessed work, and durable credentials.", url: origin, siteName: "VALORIS Network", images: [{ url: image, width: 1792, height: 922, alt: "Project VALORIS — Build, Learn, Advance" }], type: "website" }, twitter: { card: "summary_large_image", title: "Project VALORIS + Enfusion University", description: "Arma development knowledge network and Enfusion university.", images: [image] } };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, viewportFit: "cover", themeColor: "#050b09" };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}<PwaInstall/></body></html>; }
