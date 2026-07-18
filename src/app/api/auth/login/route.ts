import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { email, publicUser } from "@/lib/input";
import { policyCompliance } from "@/lib/policies";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const identifier = email(body.email);
  const user = await db.user.findFirst({ where: { OR: [{ email: identifier }, { academicEmail: identifier }] } });
  if (!user || user.suspended || !(await bcrypt.compare(String(body.password || ""), user.passwordHash))) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  await createSession(user.id);
  const compliance = user.isStudent ? await policyCompliance(user.id) : { compliant: true, missing: [] };
  return NextResponse.json({ user: publicUser(user), policyCompliant: compliance.compliant, missingPolicyVersions: compliance.missing.map((item) => ({ id: item.currentVersion.id, slug: item.slug, title: item.title, version: item.currentVersion.version })), policyGateUrl: compliance.compliant ? null : "/policies/accept" });
}
