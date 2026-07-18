import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";

export async function GET() {
  const user = await currentUser();
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: "Administrator authority required" }, { status: 403 });
  const [profiles, escalations, facultyAccounts] = await Promise.all([
    db.facultyProfile.findMany({ include: { linkedUser: { select: { id: true, name: true, academicEmail: true } }, _count: { select: { assignments: true, conversations: true } } }, orderBy: [{ isPrimaryAdvisor: "desc" }, { academy: "asc" }] }),
    db.facultyConversation.findMany({ where: { escalationStatus: "OPEN" }, include: { student: { select: { name: true, studentNumber: true } }, facultyProfile: { select: { name: true } }, course: { select: { code: true, title: true } }, messages: { orderBy: { createdAt: "desc" }, take: 4 } }, orderBy: { updatedAt: "asc" } }),
    db.user.findMany({ where: { role: "FACULTY", suspended: false }, select: { id: true, name: true, academicEmail: true } }),
  ]);
  return NextResponse.json({ profiles, escalations, facultyAccounts, messagingEnabled: process.env.FACULTY_MESSAGING_ENABLED === "true", model: process.env.GEMINI_MODEL || "gemini-3.1-pro-preview" });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: "Administrator authority required" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const name = text(body.name, 100);
  const academy = text(body.academy, 120) || null;
  const slug = text(body.slug, 80).toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (name.length < 3 || slug.length < 3) return NextResponse.json({ error: "Name and profile slug are required." }, { status: 400 });
  const profile = await db.facultyProfile.create({ data: { slug, name, title: text(body.title, 120) || "University Faculty", initials: text(body.initials, 4).toUpperCase() || name.split(" ").map((part) => part[0]).slice(-2).join("").toUpperCase(), academy, specialty: text(body.specialty, 300) || "Enfusion development education", biography: text(body.biography, 1000) || `${name} supports Enfusion University learners through structured technical study.`, teachingPhilosophy: text(body.teachingPhilosophy, 1000) || "Build understanding through evidence, reflection, and repeatable practice.", voice: text(body.voice, 500) || "Professional, patient, and specific.", userId: text(body.userId, 100) || null } });
  await db.auditLog.create({ data: { actorId: user.id, action: "FACULTY_PROFILE_CREATED", entity: "FacultyProfile", entityId: profile.id, detail: { academy } } });
  return NextResponse.json({ profile }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: "Administrator authority required" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (body.conversationId) {
    const conversationId = text(body.conversationId, 100);
    const conversation = await db.facultyConversation.findUnique({ where: { id: conversationId } });
    if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    if (text(body.ownerMessage, 2400)) await db.facultyMessage.create({ data: { conversationId, senderRole: "FACULTY", senderUserId: user.id, body: text(body.ownerMessage, 2400) } });
    await db.facultyConversation.update({ where: { id: conversationId }, data: { escalationStatus: body.resolve ? "RESOLVED" : "OPEN", lastMessageAt: new Date() } });
    await db.auditLog.create({ data: { actorId: user.id, action: body.resolve ? "FACULTY_ESCALATION_RESOLVED" : "FACULTY_CONVERSATION_INTERVENED", entity: "FacultyConversation", entityId: conversationId } });
    return NextResponse.json({ ok: true });
  }
  const id = text(body.id, 100);
  const deliveryMode = String(body.deliveryMode || "");
  const profile = await db.facultyProfile.update({ where: { id }, data: { active: body.active !== false, deliveryMode: ["AUTOMATED", "ASSISTED", "HUMAN", "PAUSED"].includes(deliveryMode) ? deliveryMode as "AUTOMATED" | "ASSISTED" | "HUMAN" | "PAUSED" : undefined, userId: body.userId === "" ? null : body.userId || undefined, availability: body.availability ? text(body.availability, 200) : undefined } });
  await db.auditLog.create({ data: { actorId: user.id, action: "FACULTY_PROFILE_UPDATED", entity: "FacultyProfile", entityId: id, detail: { deliveryMode: profile.deliveryMode, active: profile.active } } });
  return NextResponse.json({ profile });
}
