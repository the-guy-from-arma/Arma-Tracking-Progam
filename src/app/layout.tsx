import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { PwaInstall } from "@/components/PwaInstall";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-serif/400.css";
import "@fontsource/ibm-plex-serif/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  // Keep the social card on a university-specific, versioned URL so link
  // unfurlers cannot reuse the retired Project VALORIS preview cached at /og.png.
  const image = `${origin}/enfusion-university-social-2026.png?v=20260719`;

  return {
    title: { default: "Enfusion University", template: "%s · Enfusion University" },
    description: "Structured Enfusion Workbench education, sponsored learning, intelligent assessment, and durable academic records.",
    applicationName: "Enfusion University",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Enfusion University" },
    icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
    openGraph: {
      title: "Enfusion University — Create, Build, Innovate",
      description: "A complete online campus for Enfusion development education and studio-assessed learning.",
      url: origin,
      siteName: "Enfusion University",
      images: [{ url: image, secureUrl: image, width: 1731, height: 909, type: "image/png", alt: "Enfusion University — Create, Build, Innovate" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Enfusion University",
      description: "Structured Enfusion development education and sponsored learning.",
      images: [{ url: image, alt: "Enfusion University — Create, Build, Innovate" }],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#061421",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaInstall />
      </body>
    </html>
  );
}
