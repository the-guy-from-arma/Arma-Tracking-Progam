import { NextResponse } from "next/server";
import sharp from "sharp";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { policyGateResponse } from "@/lib/policies";

export const runtime = "nodejs";
const MAX_OUTPUT = 512 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const record = await db.studentProfileDetail.findUnique({ where: { userId: user.id }, select: { profilePhoto: true, profilePhotoMime: true, profilePhotoUpdatedAt: true } });
  if (!record?.profilePhoto) return NextResponse.json({ error: "Profile photo not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(record.profilePhoto), { headers: { "content-type": record.profilePhotoMime || "image/webp", "cache-control": "private, max-age=3600", etag: `\"${record.profilePhotoUpdatedAt?.getTime() || 0}\"` } });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const gate = await policyGateResponse(user.id); if (gate) return gate;
  const form = await request.formData(); const file = form.get("photo");
  if (!(file instanceof File) || !ALLOWED.has(file.type)) return NextResponse.json({ error: "Choose a JPEG, PNG, or WebP image." }, { status: 400 });
  if (file.size > 6 * 1024 * 1024) return NextResponse.json({ error: "The source image must be smaller than 6 MB." }, { status: 400 });
  try {
    const normalized = await sharp(Buffer.from(await file.arrayBuffer())).rotate().resize(512, 512, { fit: "cover", position: "attention" }).webp({ quality: 82 }).toBuffer();
    if (normalized.length > MAX_OUTPUT) return NextResponse.json({ error: "The normalized profile photo exceeds 512 KB." }, { status: 400 });
    const now = new Date();
    await db.$transaction([
      db.studentProfileDetail.upsert({ where: { userId: user.id }, update: { profilePhoto: normalized, profilePhotoMime: "image/webp", profilePhotoUpdatedAt: now }, create: { userId: user.id, profilePhoto: normalized, profilePhotoMime: "image/webp", profilePhotoUpdatedAt: now } }),
      db.auditLog.create({ data: { actorId: user.id, action: "PROFILE_PHOTO_UPDATED", entity: "StudentProfileDetail", detail: { mime: "image/webp", bytes: normalized.length } } }),
    ]);
    return NextResponse.json({ ok: true, updatedAt: now });
  } catch { return NextResponse.json({ error: "The image could not be processed." }, { status: 400 }); }
}

export async function DELETE() {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  await db.studentProfileDetail.updateMany({ where: { userId: user.id }, data: { profilePhoto: null, profilePhotoMime: null, profilePhotoUpdatedAt: null } });
  await db.auditLog.create({ data: { actorId: user.id, action: "PROFILE_PHOTO_REMOVED", entity: "StudentProfileDetail" } });
  return NextResponse.json({ ok: true });
}
