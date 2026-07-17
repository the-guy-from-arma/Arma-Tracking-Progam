import { redirect } from "next/navigation";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { Dashboard } from "@/components/Dashboard";

export const dynamic = "force-dynamic";
export default async function ValorisPage() { const user = await currentUser(); if (!user) redirect("/login"); const projectWhere = isAdmin(user.role) ? {} : { OR: [{ status: "ACTIVE" as const }, { ownerId: user.id }, { members: { some: { userId: user.id } } }] }; const [projects, users] = await Promise.all([db.project.findMany({ where: projectWhere, include: { owner: { select: { id: true, name: true, role: true } }, members: true, updates: { take: 1, orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } }, _count: { select: { updates: true, notes: true, objectives: true } } }, orderBy: { updatedAt: "desc" } }), db.user.findMany({ select: { id: true, email: true, name: true, role: true, specialty: true, createdAt: true }, orderBy: { createdAt: "asc" } })]); return <Dashboard initialUser={user} initialProjects={projects} initialUsers={users}/>; }
