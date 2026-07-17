import { redirect } from "next/navigation";
import { FacultyConsole } from "@/components/FacultyConsole";
import { canTeach, currentUser } from "@/lib/auth";
export default async function FacultyPage() { const user = await currentUser(); if (!user) redirect("/university/login"); if (!canTeach(user.role)) redirect("/university"); return <FacultyConsole name={user.name}/>; }
