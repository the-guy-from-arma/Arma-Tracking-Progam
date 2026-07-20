import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { publishValidatedCompilation, queueCurriculumCompilation, rollbackCourseContent } from "@/lib/curriculum-compiler";
import { text } from "@/lib/input";

async function owner() {
  const user = await currentUser();
  return user?.role === "OWNER" ? user : null;
}

export async function GET(request: Request) {
  const user = await owner();
  if (!user) return NextResponse.json({ error: "Owner authority required." }, { status: 403 });
  const query = new URL(request.url).searchParams;
  const courseId = text(query.get("courseId"), 100);
  const jobId = text(query.get("jobId"), 100);
  if (jobId) {
    const job = await db.curriculumCompileJob.findUnique({ where: { id: jobId }, include: { course: { select: { code: true, title: true, academy: true } } } });
    return job ? NextResponse.json({ job }) : NextResponse.json({ error: "Compilation job not found." }, { status: 404 });
  }
  const [jobs, courses] = await Promise.all([
    db.curriculumCompileJob.findMany({ where: courseId ? { courseId } : {}, select: { id: true, status: true, confidence: true, lastError: true, createdAt: true, validationResult: true, sourceRevisionIds: true, course: { select: { code: true, title: true, academy: true } } }, orderBy: { createdAt: "desc" }, take: 40 }),
    db.course.findMany({ where: { status: "PUBLISHED" }, select: { id: true, code: true, title: true, academy: true, _count: { select: { days: true } } }, orderBy: [{ academy: "asc" }, { code: "asc" }] }),
  ]);
  return NextResponse.json({ jobs: jobs.map((job) => ({ ...job, hasPreview: ["VALIDATED", "PUBLISHED", "EXCEPTION"].includes(job.status) })), courses, enabled: process.env.CURRICULUM_COMPILER_ENABLED === "true", autoPublish: process.env.CURRICULUM_AUTO_PUBLISH === "true", threshold: Number(process.env.CURRICULUM_PUBLISH_CONFIDENCE || 0.9) });
}

export async function POST(request: Request) {
  const user = await owner();
  if (!user) return NextResponse.json({ error: "Owner authority required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const action = text(body.action, 30);
  if (action === "queue") {
    let courseIds = Array.isArray(body.courseIds) ? body.courseIds.map((id: unknown) => text(id, 100)).filter(Boolean) : [];
    const academy = text(body.academy, 120);
    if (!courseIds.length && (body.scope === "ALL" || academy)) {
      courseIds = (await db.course.findMany({ where: { status: "PUBLISHED", ...(academy ? { academy } : {}) }, select: { id: true } })).map((course) => course.id);
    }
    if (!courseIds.length) return NextResponse.json({ error: "Select a course, academy, or the complete catalog." }, { status: 400 });
    const jobs = await queueCurriculumCompilation(courseIds, { actorId: user.id, mode: text(body.mode, 30) || "NORMAL" });
    await db.auditLog.create({ data: { actorId: user.id, action: "CURRICULUM_COMPILATION_QUEUED", entity: "Course", detail: { courseIds, jobs: jobs.map((job) => job.id) } } });
    return NextResponse.json({ queued: jobs.length, jobs }, { status: 202 });
  }
  if (action === "publish") {
    const jobId = text(body.jobId, 100);
    try { await publishValidatedCompilation(jobId, user.id); return NextResponse.json({ published: true }); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Compilation could not be published." }, { status: 409 }); }
  }
  if (action === "rollback") {
    const courseId = text(body.courseId, 100);
    try { await rollbackCourseContent(courseId, user.id); return NextResponse.json({ rolledBack: true }); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Course could not be rolled back." }, { status: 409 }); }
  }
  if (action === "reject") {
    const jobId = text(body.jobId, 100); const reason = text(body.reason, 500);
    if (reason.length < 10) return NextResponse.json({ error: "Record a rejection reason of at least 10 characters." }, { status: 400 });
    const job = await db.curriculumCompileJob.update({ where: { id: jobId }, data: { status: "CANCELLED", lastError: reason, completedAt: new Date() } });
    await db.lessonContentVersion.updateMany({ where: { compileJobId: job.id, status: "VALIDATED" }, data: { status: "REJECTED" } });
    await db.auditLog.create({ data: { actorId: user.id, action: "CURRICULUM_COMPILATION_REJECTED", entity: "CurriculumCompileJob", entityId: jobId, detail: { reason } } });
    return NextResponse.json({ rejected: true });
  }
  return NextResponse.json({ error: "Unknown curriculum compiler action." }, { status: 400 });
}
