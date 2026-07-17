import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { email, publicUser } from "@/lib/input";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const user = await db.user.findUnique({ where: { email: email(body.email) } });
  if (!user || user.suspended || !(await bcrypt.compare(String(body.password || ""), user.passwordHash))) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  await createSession(user.id);
  return NextResponse.json({ user: publicUser(user) });
}
