import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";

export const SESSION_COOKIE = "valoris_session";
const sessionDays = Math.max(1, Number(process.env.SESSION_DAYS || 30));
const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionDays * 86400000);
  await db.session.create({ data: { tokenHash: hash(token), userId, expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hash(token) } }).catch(() => undefined);
  jar.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", expires: new Date(0) });
}

export async function currentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hash(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || session.user.suspended) return null;
  const { passwordHash: _, ...user } = session.user;
  return user;
}

export function isAdmin(role: string) { return role === "ADMIN" || role === "OWNER"; }
