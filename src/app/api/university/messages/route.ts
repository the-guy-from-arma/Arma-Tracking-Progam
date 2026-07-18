import { after, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";
import {
  processNextFacultyReply,
  queueFacultyReply,
  requestFacultySupport,
  retryFacultyReply,
  studentFacultyConversations,
} from "@/lib/faculty-network";
import { policyGateResponse } from "@/lib/policies";

export const runtime = "nodejs";
export const maxDuration = 60;

function wakeFacultyQueue() {
  after(async () => {
    try {
      await processNextFacultyReply();
    } catch (error) {
      console.error(
        "Faculty queue wake-up failed",
        error instanceof Error ? error.message : "Unknown queue error",
      );
    }
  });
}

export async function GET() {
  const user = await currentUser();
  if (!user)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  {
    const gate = await policyGateResponse(user.id);
    if (gate) return gate;
  }
  const result = await studentFacultyConversations(user.id);
  const hasActiveReply = result.conversations.some((conversation) =>
    conversation.replyJobs.some((job) =>
      ["QUEUED", "PROCESSING"].includes(job.status),
    ),
  );
  if (hasActiveReply) wakeFacultyQueue();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  {
    const gate = await policyGateResponse(user.id);
    if (gate) return gate;
  }
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "send");
  const conversationId = text(body.conversationId, 100);
  const conversation = await db.facultyConversation.findFirst({
    where: { id: conversationId, studentId: user.id },
  });
  if (!conversation)
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  if (action === "send") {
    try {
      const result = await queueFacultyReply(
        user.id,
        conversationId,
        text(body.message, 2400),
        text(body.clientMessageId, 100),
      );
      wakeFacultyQueue();
      return NextResponse.json(result, { status: 202 });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Message could not be sent",
        },
        { status: 400 },
      );
    }
  }
  if (action === "retry") {
    try {
      const job = await retryFacultyReply(
        user.id,
        conversationId,
        text(body.jobId, 100),
      );
      wakeFacultyQueue();
      return NextResponse.json({ job }, { status: 202 });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Response could not be retried",
        },
        { status: 400 },
      );
    }
  }
  if (action === "support") {
    try {
      return NextResponse.json(
        {
          job: await requestFacultySupport(
            user.id,
            conversationId,
            text(body.jobId, 100),
          ),
        },
        { status: 202 },
      );
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Support could not be requested",
        },
        { status: 400 },
      );
    }
  }
  if (action === "mute")
    await db.facultyConversation.update({
      where: { id: conversationId },
      data: { muted: Boolean(body.muted) },
    });
  else if (action === "read")
    await db.facultyConversation.update({
      where: { id: conversationId },
      data: { lastReadByStudentAt: new Date() },
    });
  else
    return NextResponse.json(
      { error: "Unknown message action" },
      { status: 400 },
    );
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  {
    const gate = await policyGateResponse(user.id);
    if (gate) return gate;
  }
  const body = await request.json().catch(() => ({}));
  const quietHoursStart = Math.max(
    0,
    Math.min(23, Number(body.quietHoursStart ?? 20)),
  );
  const quietHoursEnd = Math.max(
    0,
    Math.min(23, Number(body.quietHoursEnd ?? 8)),
  );
  const supportProfile = await db.studentSupportProfile.upsert({
    where: { userId: user.id },
    update: {
      outreachEnabled: body.outreachEnabled !== false,
      quietHoursStart,
      quietHoursEnd,
    },
    create: {
      userId: user.id,
      outreachEnabled: body.outreachEnabled !== false,
      quietHoursStart,
      quietHoursEnd,
    },
  });
  return NextResponse.json({ supportProfile });
}
