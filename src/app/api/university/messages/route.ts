import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";
import { queueFacultyReply, studentFacultyConversations } from "@/lib/faculty-network";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  return NextResponse.json(await studentFacultyConversations(user.id));
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "send");
  const conversationId = text(body.conversationId, 100);
  const conversation = await db.facultyConversation.findFirst({ where: { id: conversationId, studentId: user.id } });
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  if (action === "send") {
    try { return NextResponse.json(await queueFacultyReply(user.id, conversationId, text(body.message, 2400)), { status: 202 }); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Message could not be sent" }, { status: 400 }); }
  }
  if (action === "mute") await db.facultyConversation.update({ where: { id: conversationId }, data: { muted: Boolean(body.muted) } });
  else if (action === "read") await db.facultyConversation.update({ where: { id: conversationId }, data: { lastReadByStudentAt: new Date() } });
  else return NextResponse.json({ error: "Unknown message action" }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const quietHoursStart = Math.max(0, Math.min(23, Number(body.quietHoursStart ?? 20)));
  const quietHoursEnd = Math.max(0, Math.min(23, Number(body.quietHoursEnd ?? 8)));
  const supportProfile = await db.studentSupportProfile.upsert({ where: { userId: user.id }, update: { outreachEnabled: body.outreachEnabled !== false, quietHoursStart, quietHoursEnd }, create: { userId: user.id, outreachEnabled: body.outreachEnabled !== false, quietHoursStart, quietHoursEnd } });
  return NextResponse.json({ supportProfile });
}
