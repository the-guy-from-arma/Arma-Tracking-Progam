import type { Metadata, Viewport } from "next";
import { PwaInstall } from "@/components/PwaInstall";
import "./globals.css";

export const metadata: Metadata = { title: { default: "ForgeOps", template: "%s · ForgeOps" }, description: "Project command for Arma Reforger and Enfusion teams.", applicationName: "ForgeOps", manifest: "/manifest.webmanifest", appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ForgeOps" }, icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, viewportFit: "cover", themeColor: "#050b09" };
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}<PwaInstall /></body></html>}
