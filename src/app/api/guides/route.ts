import { NextResponse } from "next/server";
import { canTeach, currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";

const catalog = [
  ["faculty-course-delivery","FACULTY","Operate a Course","Course delivery","Publish learning days, monitor progress, and preserve faculty-authored instruction.","/faculty",["Review the course record","Validate source grounding","Monitor daily progress","Release feedback"]],
  ["faculty-gemini-review","FACULTY","Review Gemini Exceptions","Assessment","Validate low-confidence grading, citations, integrity flags, and appeals.","/faculty",["Open the exception queue","Compare rubric evidence","Verify approved citations","Record a faculty decision"]],
  ["faculty-credentials","FACULTY","Issue Completion Credentials","Credentials","Verify program completion and issue the correct completion record.","/faculty",["Confirm required courses","Review final artifact","Resolve appeals","Issue the credential"]],
  ["admin-admissions","ADMIN","Process Admissions","Admissions","Move applications through review while preserving tracking history.","/owner",["Open an application","Review learner readiness","Record a decision","Confirm tracking closure"]],
  ["admin-sources","ADMIN","Diagnose Curriculum Sources","Curriculum","Read failures, correct mappings, force updates, and document bypasses.","/owner",["Filter sources needing attention","Open the diagnostic drawer","Verify the approved Wiki URL","Retry, correct, or document a bypass"]],
  ["admin-funding","ADMIN","Operate Sponsored Funding","Funding","Review ledger activity and manage effective withdrawal policies.","/owner",["Filter the funding ledger","Review policy tiers","Audit a withdrawal snapshot","Publish an effective policy change"]],
  ["admin-railway","ADMIN","Verify Railway Jobs","Operations","Validate Wiki sync, Gemini worker, and funding renewal configuration.","/owner",["Check protected variables","Test Gemini connectivity","Review job audit records","Confirm the next scheduled run"]],
] as const;

async function ensureGuides() {
  for (const [slug,audience,title,category,summary,route,steps] of catalog) {
    const guide = await db.guide.upsert({ where: { slug }, update: { title, summary, category, route, published: true }, create: { slug, audience, title, summary, category, route } });
    for (const [index, instruction] of steps.entries()) await db.guideStep.upsert({ where: { guideId_stepNumber: { guideId: guide.id, stepNumber: index + 1 } }, update: { title: instruction, instruction }, create: { guideId: guide.id, stepNumber: index + 1, title: instruction, instruction } });
  }
}

export async function GET() {
  const user = await currentUser(); if (!user || !canTeach(user.role)) return NextResponse.json({ error: "Faculty or administrator authority required." }, { status: 403 });
  await ensureGuides(); const audiences = isAdmin(user.role) ? ["FACULTY","ADMIN"] : ["FACULTY"];
  const guides = await db.guide.findMany({ where: { audience: { in: audiences as never[] }, published: true }, include: { steps: { include: { progress: { where: { userId: user.id } } }, orderBy: { stepNumber: "asc" } } }, orderBy: [{ audience: "asc" }, { sortOrder: "asc" }, { title: "asc" }] });
  return NextResponse.json({ guides });
}

export async function PATCH(request: Request) {
  const user = await currentUser(); if (!user || !canTeach(user.role)) return NextResponse.json({ error: "Faculty or administrator authority required." }, { status: 403 });
  const body = await request.json().catch(() => ({})); const guideStepId = text(body.guideStepId, 100); const completed = body.completed !== false;
  const step = await db.guideStep.findUnique({ where: { id: guideStepId }, include: { guide: true } });
  if (!step || (step.guide.audience === "ADMIN" && !isAdmin(user.role))) return NextResponse.json({ error: "Guide step unavailable." }, { status: 404 });
  if (completed) await db.guideProgress.upsert({ where: { userId_guideStepId: { userId: user.id, guideStepId } }, update: { completedAt: new Date() }, create: { userId: user.id, guideStepId } });
  else await db.guideProgress.deleteMany({ where: { userId: user.id, guideStepId } });
  return NextResponse.json({ completed });
}
