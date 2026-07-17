import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { email, publicUser, text } from "@/lib/input";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const normalizedEmail = email(body.email); const name = text(body.name, 80); const password = String(body.password || "");
  if (!normalizedEmail.includes("@") || name.length < 2 || password.length < 10) return NextResponse.json({ error: "Use a valid name, email, and password of at least 10 characters." }, { status: 400 });
  if (await db.user.findUnique({ where: { email: normalizedEmail } })) return NextResponse.json({ error: "An account already exists for that email." }, { status: 409 });
  const user = await db.user.create({ data: { email: normalizedEmail, name, passwordHash: await bcrypt.hash(password, 12), specialty: text(body.specialty, 80) || null } });
  await db.auditLog.create({ data: { actorId: user.id, action: "ACCOUNT_CREATED", entity: "User", entityId: user.id } });
  await createSession(user.id);
  return NextResponse.json({ user: publicUser(user) }, { status: 201 });
}
