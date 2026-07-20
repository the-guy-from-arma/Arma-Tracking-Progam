import type { Metadata } from "next";
import { PolicyCenter } from "@/components/PolicyCenter";
export const metadata: Metadata = { title: "Policy Center | Enscript University", description: "Terms, privacy, sponsored value, academic integrity, credentials, and automated academic systems disclosures." };
export default function PoliciesPage(){ return <PolicyCenter />; }
