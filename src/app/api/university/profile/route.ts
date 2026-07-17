import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { recalculateFundingStanding } from "@/lib/funding-standing";

export async function GET() {
  const sessionUser = await currentUser();
  if (!sessionUser) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const standing = await recalculateFundingStanding(sessionUser.id);
  const user = await db.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: { id: true, name: true, email: true, academicEmail: true, studentNumber: true, specialty: true, createdAt: true, grantBalanceCents: true, studentApplication: true, courseEnrollments: { include: { course: { select: { code: true, title: true } } }, orderBy: { enrolledAt: "desc" } }, programEnrollments: { include: { program: { select: { code: true, title: true, level: true, academy: true, creditsRequired: true } } }, orderBy: { enrolledAt: "desc" } }, certificates: { select: { id: true, title: true, credentialCode: true, issuedAt: true, learningCredits: true }, orderBy: { issuedAt: "desc" } }, applicationTrackers: { include: { programApplication: { select: { program: { select: { code: true, title: true } } } }, studentApplication: { select: { status: true } } }, orderBy: { createdAt: "desc" } } },
  });
  return NextResponse.json({ user, standing });
}
