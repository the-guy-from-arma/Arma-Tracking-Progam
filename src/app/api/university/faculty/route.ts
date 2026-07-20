import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { policyGateResponse } from "@/lib/policies";

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  if (!user)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  const gate = await policyGateResponse(user.id);
  if (gate) return gate;

  const faculty = await db.facultyProfile.findMany({
    where: { active: true },
    select: {
      id: true,
      slug: true,
      name: true,
      title: true,
      initials: true,
      academy: true,
      specialty: true,
      biography: true,
      teachingPhilosophy: true,
      availability: true,
      isPrimaryAdvisor: true,
      conversations: {
        where: { studentId: user.id },
        select: { id: true },
        orderBy: { lastMessageAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ academy: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({
    faculty: faculty.map((member) => ({
      ...member,
      conversationId: member.conversations[0]?.id || null,
      conversations: undefined,
    })),
  });
}
