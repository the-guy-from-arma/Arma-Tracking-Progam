import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

async function owner() { const user = await currentUser(); return user?.role === "OWNER" ? user : null; }

export async function GET() {
  if (!await owner()) return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  const schedule = await db.valueRateSchedule.findFirst({ where: { active: true }, orderBy: { effectiveFrom: "desc" } });
  return NextResponse.json({ schedule, degreeWordingEnabled: process.env.DEGREE_WORDING_ENABLED === "true" });
}

export async function PATCH(request: Request) {
  const actor = await owner();
  if (!actor) return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const fields = ["hourlyInstruction", "labServices", "aiAssessment", "studioServices", "credentialAdmin"] as const;
  const values = Object.fromEntries(fields.map((field) => [field, Math.round(Number(body[field]) * 100)])) as Record<(typeof fields)[number], number>;
  if (fields.some((field) => !Number.isSafeInteger(values[field]) || values[field] < 0 || values[field] > 10_000_000)) return NextResponse.json({ error: "Enter valid non-negative service rates no greater than $100,000 per component." }, { status: 400 });
  const now = new Date();
  const schedule = await db.$transaction(async (tx) => {
    await tx.valueRateSchedule.updateMany({ where: { active: true }, data: { active: false, effectiveTo: now } });
    const created = await tx.valueRateSchedule.create({ data: { name: String(body.name || "Sponsored Learning Schedule").slice(0, 100), hourlyInstructionCents: values.hourlyInstruction, labServicesCents: values.labServices, aiAssessmentCents: values.aiAssessment, studioServicesCents: values.studioServices, credentialAdminCents: values.credentialAdmin, effectiveFrom: now } });
    const courses = await tx.course.findMany({ where: { wikiManaged: true }, select: { id: true, workloadHours: true, level: true } });
    for (const course of courses) await tx.course.update({ where: { id: course.id }, data: { serviceValueCents: course.workloadHours * values.hourlyInstruction + values.labServices + values.aiAssessment + values.studioServices + (course.level === "CAPSTONE" ? values.credentialAdmin : 0) } });
    const programs = await tx.academicProgram.findMany({ include: { requirements: { include: { course: { select: { serviceValueCents: true } } } } } });
    for (const program of programs) await tx.academicProgram.update({ where: { id: program.id }, data: { estimatedValueCents: program.requirements.reduce((sum, requirement) => sum + requirement.course.serviceValueCents, 0) } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "VALUE_SCHEDULE_PUBLISHED", entity: "ValueRateSchedule", entityId: created.id, detail: { coursesRevalued: courses.length } } });
    return created;
  });
  return NextResponse.json({ schedule });
}
