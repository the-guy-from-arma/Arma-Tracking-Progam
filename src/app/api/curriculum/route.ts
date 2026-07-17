import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const courses = await db.course.findMany({
    where: isAdmin(user.role) ? {} : { status: "PUBLISHED" },
    include: {
      prerequisites: { include: { prerequisite: { select: { id: true, code: true, title: true } } } },
      enrollments: { where: { userId: user.id } },
      days: { select: { id: true } },
      sources: { select: { id: true, syncStatus: true, statusWarnings: true, lastSyncedAt: true } },
      _count: { select: { enrollments: true, days: true } },
    },
    orderBy: [{ academy: "asc" }, { code: "asc" }],
  });
  const completedByCourse = await db.lessonProgress.groupBy({ where: { userId: user.id, completed: true }, by: ["courseDayId"], _count: true });
  const completedIds = new Set(completedByCourse.map((item) => item.courseDayId));
  const normalized = courses.map((course) => ({ ...course, completedDays: course.days.filter((day) => completedIds.has(day.id)).length, days: undefined }));
  const academies = [...new Set(courses.map((course) => course.academy))];
  const enrolled = normalized.filter((course) => course.enrollments.length > 0);
  const nextCourse = enrolled.find((course) => course.completedDays < course._count.days) || null;
  return NextResponse.json({ courses: normalized, academies, enrolled, nextCourse, grantBalanceCents: user.grantBalanceCents, coverage: { mapped: courses.filter((course) => course.sources.length).length, total: courses.length } });
}
