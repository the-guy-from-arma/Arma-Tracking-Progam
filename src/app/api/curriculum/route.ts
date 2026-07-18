import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCompletedCourseIds } from "@/lib/academic-progress";
import { policyGateResponse } from "@/lib/policies";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (user.isStudent) { const gate = await policyGateResponse(user.id); if (gate) return gate; }
  const [courses, fulfilledCourseIds, openApplications, pendingSubmissions, unreadFeedback, credentials] = await Promise.all([db.course.findMany({
    where: isAdmin(user.role) ? {} : { status: "PUBLISHED" },
    include: {
      prerequisites: { include: { prerequisite: { select: { id: true, code: true, title: true } } } },
      enrollments: { where: { userId: user.id, status: { in: ["ACTIVE", "COMPLETED"] } } },
      days: { select: { id: true } },
      sourceMappings: { include: { source: { select: { id: true, syncStatus: true, statusWarnings: true, lastSyncedAt: true } } } },
      _count: { select: { enrollments: true, days: true } },
    },
    orderBy: [{ academy: "asc" }, { code: "asc" }],
  }), getCompletedCourseIds(user.id), db.applicationTracking.count({ where: { userId: user.id, status: { in: ["OPEN", "IN_REVIEW"] } } }), db.courseSubmission.count({ where: { studentId: user.id, status: { in: ["SUBMITTED", "PENDING_AI_REVIEW", "AI_REVIEWING", "AI_EXCEPTION", "IN_REVIEW"] } } }), db.courseSubmission.count({ where: { studentId: user.id, feedback: { not: null } } }), db.certificate.count({ where: { userId: user.id } })]);
  const completedByCourse = await db.lessonProgress.groupBy({ where: { userId: user.id, completed: true }, by: ["courseDayId"], _count: true });
  const completedIds = new Set(completedByCourse.map((item) => item.courseDayId));
  const normalized = courses.map((course) => ({ ...course, fulfilled: fulfilledCourseIds.has(course.id), sources: course.sourceMappings.map((mapping) => mapping.source), sourceMappings: undefined, completedDays: course.days.filter((day) => completedIds.has(day.id)).length, days: undefined }));
  const academies = [...new Set(courses.map((course) => course.academy))];
  const enrolled = normalized.filter((course) => course.enrollments.length > 0);
  const nextCourse = enrolled.find((course) => course.completedDays < course._count.days) || null;
  return NextResponse.json({ courses: normalized, academies, enrolled, nextCourse, grantBalanceCents: user.grantBalanceCents, serviceCounts: { openApplications, activeEnrollments: enrolled.filter((course) => course.enrollments.some((item) => item.status === "ACTIVE")).length, pendingSubmissions, unreadFeedback, credentials }, coverage: { mapped: courses.filter((course) => course.sourceMappings.length).length, total: courses.length } });
}
