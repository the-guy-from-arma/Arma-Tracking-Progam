import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";
import { policyGateResponse } from "@/lib/policies";
import { recalculateFundingStanding } from "@/lib/funding-standing";

const ACADEMIES = ["Setup & Foundations", "Resource Manager", "Scripting", "Gameplay Systems", "Replication", "Terrain", "AI", "UI", "Audio", "Animation", "VFX", "Weapons", "Vehicles", "Characters", "Scenarios", "Testing & Publishing"];

function cleanOptional(value: unknown, max: number) {
  const result = text(value, max);
  return result || null;
}

export async function GET() {
  const sessionUser = await currentUser();
  if (!sessionUser) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const gate = await policyGateResponse(sessionUser.id); if (gate) return gate;
  const standing = await recalculateFundingStanding(sessionUser.id);
  const user = await db.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: {
      id: true, name: true, email: true, academicEmail: true, studentNumber: true, specialty: true, createdAt: true, grantBalanceCents: true,
      profileDetails: { select: { addressLine1: true, addressLine2: true, city: true, region: true, postalCode: true, country: true, phone: true, emergencyName: true, emergencyRelationship: true, emergencyPhone: true, veteranStatus: true, residencyStatus: true, preferredPronouns: true, minorAcademy: true, profilePhotoUpdatedAt: true } },
      studentApplication: { select: { preferredName: true, country: true, timeZone: true, experienceLevel: true, weeklyHours: true } },
      courseEnrollments: { include: { course: { select: { id: true, code: true, title: true, learningCredits: true } } }, orderBy: { enrolledAt: "desc" } },
      programEnrollments: { include: { program: { select: { id: true, code: true, title: true, level: true, academy: true, creditsRequired: true, requirements: { select: { courseId: true } } } } }, orderBy: { enrolledAt: "desc" } },
      certificates: { select: { id: true, title: true, credentialCode: true, issuedAt: true, learningCredits: true }, orderBy: { issuedAt: "desc" } },
      applicationTrackers: { include: { programApplication: { select: { program: { select: { code: true, title: true } } } }, studentApplication: { select: { status: true } } }, orderBy: { createdAt: "desc" } },
      facultyAssignments: { where: { active: true, type: "PRIMARY_ADVISOR" }, include: { facultyProfile: { select: { name: true, title: true, initials: true } } }, take: 1 },
      studentActivities: { orderBy: { occurredAt: "desc" }, take: 30 },
      grantLedger: { select: { id: true, type: true, description: true, amountCents: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  const completed = user.courseEnrollments.filter((item) => item.status === "COMPLETED");
  const completedCredits = completed.reduce((sum, item) => sum + item.course.learningCredits, 0);
  const activeProgram = user.programEnrollments.find((item) => item.status === "ACTIVE") || user.programEnrollments[0] || null;
  const earnedCredits = Math.max(completedCredits, activeProgram?.creditsEarned || 0);
  const requiredCredits = activeProgram?.program.creditsRequired || 0;
  const progressPercent = requiredCredits ? Math.min(100, Math.round(earnedCredits / requiredCredits * 100)) : 0;
  const activeCourses = user.courseEnrollments.filter((item) => item.status === "ACTIVE");
  const engagementWeeks = new Set(user.studentActivities.filter((item) => ["GRADE", "ADVISING", "ENROLLMENT", "CREDENTIAL"].includes(item.type)).map((item) => {
    const date = new Date(item.occurredAt); const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1)); return `${date.getUTCFullYear()}-${Math.ceil(((+date - +start) / 86400000 + start.getUTCDay() + 1) / 7)}`;
  })).size;
  const elapsedWeeks = Math.max(1, Math.ceil((Date.now() - +new Date(user.createdAt)) / 604800000));
  const engagementAttendance = Math.min(100, Math.round(engagementWeeks / elapsedWeeks * 100));
  const remaining = Math.max(0, requiredCredits - earnedCredits);
  const weeklyPace = Math.max(1, user.studentApplication?.weeklyHours || 8);
  const anticipatedCompletion = requiredCredits ? new Date(Date.now() + Math.ceil(remaining / Math.max(1, weeklyPace / 5)) * 7 * 86400000).toISOString() : null;
  const derivedActivity = [
    ...user.courseEnrollments.map((item) => ({ id: `enrollment-${item.id}`, type: "ENROLLMENT", title: `${item.status === "COMPLETED" ? "Completed" : item.status === "WITHDRAWN" ? "Withdrew from" : "Enrolled in"} ${item.course.code}`, detail: item.course.title, occurredAt: item.completedAt || item.withdrawnAt || item.enrolledAt })),
    ...user.certificates.map((item) => ({ id: `credential-${item.id}`, type: "CREDENTIAL", title: "Credential earned", detail: `${item.title} · ${item.credentialCode}`, occurredAt: item.issuedAt })),
    ...user.applicationTrackers.map((item) => ({ id: `application-${item.id}`, type: "APPLICATION", title: `${item.type.replaceAll("_", " ")} application ${item.status.toLowerCase().replaceAll("_", " ")}`, detail: item.outcome || item.trackingNumber, occurredAt: item.closedAt || item.submittedAt })),
    ...user.grantLedger.map((item) => ({ id: `funding-${item.id}`, type: "FUNDING", title: item.type.replaceAll("_", " "), detail: item.description, occurredAt: item.createdAt })),
    ...user.studentActivities,
  ].sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt)).slice(0, 30);
  return NextResponse.json({
    user: { ...user, studentActivities: derivedActivity, grantLedger: undefined },
    standing,
    academic: { activeProgram, earnedCredits, requiredCredits, progressPercent, activeCourses: activeCourses.length, completedCourses: completed.length, engagementAttendance, anticipatedCompletion, advisor: user.facultyAssignments[0]?.facultyProfile || null },
    funding: { studentResponsibilityCents: 0, sponsoredValueReceivedCents: Math.max(0, user.grantBalanceCents), paymentStatus: "NO_PAYMENT_REQUIRED" },
    academies: ACADEMIES,
  });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const gate = await policyGateResponse(user.id); if (gate) return gate;
  const body = await request.json().catch(() => ({}));
  const veteranStatus = ["NOT_DISCLOSED", "NOT_A_VETERAN", "VETERAN", "ACTIVE_DUTY", "RESERVE_OR_GUARD", "MILITARY_FAMILY"].includes(String(body.veteranStatus)) ? body.veteranStatus : "NOT_DISCLOSED";
  const residencyStatus = ["NOT_DISCLOSED", "DOMESTIC", "INTERNATIONAL", "OTHER"].includes(String(body.residencyStatus)) ? body.residencyStatus : "NOT_DISCLOSED";
  const data = {
    addressLine1: cleanOptional(body.addressLine1, 160), addressLine2: cleanOptional(body.addressLine2, 160), city: cleanOptional(body.city, 100), region: cleanOptional(body.region, 100), postalCode: cleanOptional(body.postalCode, 30), country: cleanOptional(body.country, 100), phone: cleanOptional(body.phone, 40), emergencyName: cleanOptional(body.emergencyName, 140), emergencyRelationship: cleanOptional(body.emergencyRelationship, 80), emergencyPhone: cleanOptional(body.emergencyPhone, 40), preferredPronouns: cleanOptional(body.preferredPronouns, 60), minorAcademy: cleanOptional(body.minorAcademy, 120), veteranStatus, residencyStatus,
  };
  const profile = await db.$transaction(async (tx) => {
    const updated = await tx.studentProfileDetail.upsert({ where: { userId: user.id }, update: data, create: { userId: user.id, ...data } });
    await tx.studentActivityEvent.create({ data: { studentId: user.id, actorId: user.id, type: "PROFILE", title: "Student profile updated", detail: "Private contact and academic preference information was updated.", entity: "StudentProfileDetail", entityId: updated.id } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "STUDENT_PROFILE_UPDATED", entity: "StudentProfileDetail", entityId: updated.id, detail: { fields: Object.keys(data).filter((key) => data[key as keyof typeof data] != null) } } });
    return updated;
  });
  return NextResponse.json({ profile });
}
