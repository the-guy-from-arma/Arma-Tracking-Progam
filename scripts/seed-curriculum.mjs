import { PrismaClient } from "@prisma/client";
import { academies, makeDay, sourceUrl, wikiTitle } from "./curriculum-data.mjs";

const db = new PrismaClient();
const studio = "Thunder Buddies Studios + Black Ridge Studios";
const durations = [5, 10, 15, 20];
const levels = ["FOUNDATION", "INTERMEDIATE", "ADVANCED", "CAPSTONE"];

try {
  let courseCount = 0; let dayCount = 0;
  for (let academyIndex = 0; academyIndex < academies.length; academyIndex++) {
    const [academy, editor, subjects] = academies[academyIndex];
    let previous = null;
    for (let subjectIndex = 0; subjectIndex < subjects.length; subjectIndex++) {
      const subject = subjects[subjectIndex]; const estimatedDays = durations[subjectIndex];
      const code = `EFU-${String(academyIndex + 1).padStart(2, "0")}${subjectIndex + 1}`;
      const source = wikiTitle(subject); const url = sourceUrl(source);
      const course = await db.course.upsert({
        where: { code },
        update: { title: subject, academy, estimatedDays, workloadHours: estimatedDays * 2, wikiManaged: true, status: "PUBLISHED", outcomes: [`Operate ${editor} safely`, `Apply official guidance to ${subject}`, "Validate and document a repeatable result"] },
        create: { code, title: subject, summary: `A step-by-step ${estimatedDays}-day studio course in ${subject}, grounded in current Bohemia Interactive technical guidance.`, deliverable: `Complete the ${subject} practical build, validation record, reflection log, and studio-ready demonstration.`, studio, level: levels[subjectIndex], status: "PUBLISHED", learningCredits: Math.max(2, Math.ceil(estimatedDays / 4)), serviceValueCents: estimatedDays * 125000, academy, estimatedDays, workloadHours: estimatedDays * 2, wikiManaged: true, outcomes: [`Operate ${editor} safely`, `Apply official guidance to ${subject}`, "Validate and document a repeatable result"] },
      });
      await db.curriculumSource.upsert({ where: { wikiTitle: source }, update: { url, courseId: course.id }, create: { wikiTitle: source, url, sourceExcerpt: `Official technical source supporting the ${subject} course.`, courseId: course.id } });
      const courseDays = Array.from({ length: estimatedDays }, (_, index) => ({ courseId: course.id, ...makeDay({ subject, editor, dayNumber: index + 1, days: estimatedDays, source }) }));
      await db.courseDay.createMany({ data: courseDays, skipDuplicates: true });
      dayCount += courseDays.length;
      if (previous) await db.coursePrerequisite.upsert({ where: { courseId_prerequisiteId: { courseId: course.id, prerequisiteId: previous } }, update: {}, create: { courseId: course.id, prerequisiteId: previous } });
      previous = course.id; courseCount++;
    }
  }
  console.log(`[curriculum] ${courseCount} courses and ${dayCount} course days are ready across ${academies.length} academies.`);
} finally { await db.$disconnect(); }
