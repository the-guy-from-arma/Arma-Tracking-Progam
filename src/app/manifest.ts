import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Enscript University",
    short_name: "Enscript U",
    description: "Structured Enfusion Workbench development education, sponsored learning, and academic records.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#061421",
    theme_color: "#061421",
    categories: ["education", "productivity", "developer tools"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "University home", url: "/" },
      { name: "Student campus", url: "/university" },
      { name: "Admissions", url: "/university/register" },
    ],
  };
}
