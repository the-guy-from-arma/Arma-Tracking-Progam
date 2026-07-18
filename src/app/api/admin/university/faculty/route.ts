import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";

export async function GET() {
  const user = await currentUser();
  if (!user || !isAdmin(user.role))
    return NextResponse.json(
      { error: "Administrator authority required" },
      { status: 403 },
    );
  const staleBefore = new Date(Date.now() - 5 * 60_000);
  const [profiles, escalations, facultyAccounts, jobs, staleJobs] =
    await Promise.all([
      db.facultyProfile.findMany({
        include: {
          linkedUser: { select: { id: true, name: true, academicEmail: true } },
          _count: { select: { assignments: true, conversations: true } },
        },
        orderBy: [{ isPrimaryAdvisor: "desc" }, { academy: "asc" }],
      }),
      db.facultyConversation.findMany({
        where: { escalationStatus: "OPEN" },
        include: {
          student: { select: { name: true, studentNumber: true } },
          facultyProfile: { select: { name: true } },
          course: { select: { code: true, title: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 4 },
        },
        orderBy: { updatedAt: "asc" },
      }),
      db.user.findMany({
        where: { role: "FACULTY", suspended: false },
        select: { id: true, name: true, academicEmail: true },
      }),
      db.facultyReplyJob.findMany({
        where: {
          status: {
            in: ["QUEUED", "PROCESSING", "WAITING_FOR_CONSENT", "EXCEPTION"],
          },
        },
        include: {
          conversation: {
            select: {
              student: { select: { name: true, studentNumber: true } },
              facultyProfile: { select: { name: true } },
            },
          },
        },
        orderBy: { updatedAt: "asc" },
        take: 50,
      }),
      db.facultyReplyJob.count({
        where: { status: "PROCESSING", lockedAt: { lt: staleBefore } },
      }),
    ]);
  const messagingEnabled = process.env.FACULTY_MESSAGING_ENABLED === "true";
  const facultyKey = process.env.FACULTY_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const keyConfigured = Boolean(
    facultyKey && !facultyKey.startsWith("replace-with"),
  );
  const workerSecretConfigured = Boolean(
    process.env.FACULTY_MESSAGING_WORKER_SECRET &&
    !process.env.FACULTY_MESSAGING_WORKER_SECRET.startsWith("replace-with"),
  );
  return NextResponse.json({
    profiles,
    escalations,
    facultyAccounts,
    jobs: jobs.map((job) => ({
      id: job.id,
      status: job.status,
      attempt: job.attempt,
      maxAttempts: job.maxAttempts,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      lockedAt: job.lockedAt,
      availableAt: job.availableAt,
      lastError: job.lastError,
      rateLimitCount: job.rateLimitCount,
      lastProviderStatus: job.lastProviderStatus,
      rateLimited: job.lastError?.startsWith("RATE_LIMITED:") || false,
      nextRetryAt: job.status === "QUEUED" ? job.availableAt : null,
      student: job.conversation.student,
      faculty: job.conversation.facultyProfile.name,
    })),
    worker: {
      enabled: messagingEnabled,
      ready: messagingEnabled && keyConfigured && workerSecretConfigured,
      keyConfigured,
      workerSecretConfigured,
      staleJobs,
      oldestJobAt: jobs[0]?.createdAt || null,
      leaseMinutes: Number(process.env.FACULTY_JOB_LEASE_MINUTES || 5),
      timeoutMs: Number(process.env.FACULTY_REPLY_TIMEOUT_MS || 45000),
      rateLimitedJobs: jobs.filter((job) => job.lastError?.startsWith("RATE_LIMITED:")).length,
      nextRetryAt: jobs
        .filter((job) => job.status === "QUEUED")
        .map((job) => job.availableAt)
        .sort((left, right) => left.getTime() - right.getTime())[0] || null,
      dedicatedKeyConfigured: Boolean(process.env.FACULTY_GEMINI_API_KEY),
      fallbackModel: process.env.FACULTY_GEMINI_FALLBACK_MODEL || null,
    },
    messagingEnabled,
    model:
      process.env.FACULTY_GEMINI_MODEL ||
      process.env.GEMINI_MODEL ||
      "gemini-3.1-pro-preview",
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !isAdmin(user.role))
    return NextResponse.json(
      { error: "Administrator authority required" },
      { status: 403 },
    );
  const body = await request.json().catch(() => ({}));
  if (body.jobId) {
    const jobId = text(body.jobId, 100);
    const job = await db.facultyReplyJob.findUnique({ where: { id: jobId } });
    if (!job)
      return NextResponse.json(
        { error: "Reply job not found" },
        { status: 404 },
      );
    await db.facultyReplyJob.update({
      where: { id: jobId },
      data: {
        status: "QUEUED",
        attempt: 0,
        lockedAt: null,
        heartbeatAt: null,
        availableAt: new Date(),
        lastError: null,
        rateLimitCount: 0,
        lastProviderStatus: null,
      },
    });
    await db.auditLog.create({
      data: {
        actorId: user.id,
        action: "FACULTY_REPLY_MANUAL_RETRY",
        entity: "FacultyReplyJob",
        entityId: jobId,
      },
    });
    return NextResponse.json({ ok: true });
  }
  const name = text(body.name, 100);
  const academy = text(body.academy, 120) || null;
  const slug = text(body.slug, 80)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
  if (name.length < 3 || slug.length < 3)
    return NextResponse.json(
      { error: "Name and profile slug are required." },
      { status: 400 },
    );
  const profile = await db.facultyProfile.create({
    data: {
      slug,
      name,
      title: text(body.title, 120) || "University Faculty",
      initials:
        text(body.initials, 4).toUpperCase() ||
        name
          .split(" ")
          .map((part) => part[0])
          .slice(-2)
          .join("")
          .toUpperCase(),
      academy,
      specialty: text(body.specialty, 300) || "Enfusion development education",
      biography:
        text(body.biography, 1000) ||
        `${name} supports Enfusion University learners through structured technical study.`,
      teachingPhilosophy:
        text(body.teachingPhilosophy, 1000) ||
        "Build understanding through evidence, reflection, and repeatable practice.",
      voice: text(body.voice, 500) || "Professional, patient, and specific.",
      userId: text(body.userId, 100) || null,
    },
  });
  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: "FACULTY_PROFILE_CREATED",
      entity: "FacultyProfile",
      entityId: profile.id,
      detail: { academy },
    },
  });
  return NextResponse.json({ profile }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user || !isAdmin(user.role))
    return NextResponse.json(
      { error: "Administrator authority required" },
      { status: 403 },
    );
  const body = await request.json().catch(() => ({}));
  if (body.conversationId) {
    const conversationId = text(body.conversationId, 100);
    const conversation = await db.facultyConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation)
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    if (text(body.ownerMessage, 2400))
      await db.facultyMessage.create({
        data: {
          conversationId,
          senderRole: "FACULTY",
          senderUserId: user.id,
          body: text(body.ownerMessage, 2400),
        },
      });
    await db.facultyConversation.update({
      where: { id: conversationId },
      data: {
        escalationStatus: body.resolve ? "RESOLVED" : "OPEN",
        lastMessageAt: new Date(),
      },
    });
    await db.auditLog.create({
      data: {
        actorId: user.id,
        action: body.resolve
          ? "FACULTY_ESCALATION_RESOLVED"
          : "FACULTY_CONVERSATION_INTERVENED",
        entity: "FacultyConversation",
        entityId: conversationId,
      },
    });
    return NextResponse.json({ ok: true });
  }
  const id = text(body.id, 100);
  const deliveryMode = String(body.deliveryMode || "");
  const profile = await db.facultyProfile.update({
    where: { id },
    data: {
      active: body.active !== false,
      deliveryMode: ["AUTOMATED", "ASSISTED", "HUMAN", "PAUSED"].includes(
        deliveryMode,
      )
        ? (deliveryMode as "AUTOMATED" | "ASSISTED" | "HUMAN" | "PAUSED")
        : undefined,
      userId: body.userId === "" ? null : body.userId || undefined,
      availability: body.availability
        ? text(body.availability, 200)
        : undefined,
    },
  });
  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: "FACULTY_PROFILE_UPDATED",
      entity: "FacultyProfile",
      entityId: id,
      detail: { deliveryMode: profile.deliveryMode, active: profile.active },
    },
  });
  return NextResponse.json({ profile });
}
