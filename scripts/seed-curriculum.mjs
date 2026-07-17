import { PrismaClient } from "@prisma/client";
import { academies, makeDay, sourceUrl, wikiTitle } from "./curriculum-data.mjs";

const db = new PrismaClient();
const studio = "Thunder Buddies Studios + Black Ridge Studios";
const durations = [5, 10, 15, 20, 5, 10, 10, 15, 15, 20, 20, 20];
const levels = ["FOUNDATION", "INTERMEDIATE", "ADVANCED", "CAPSTONE", "FOUNDATION", "INTERMEDIATE", "INTERMEDIATE", "ADVANCED", "ADVANCED", "CAPSTONE", "CAPSTONE", "CAPSTONE"];
const programTracks = ["Systems", "Production", "Leadership"];

function uniqueCourses(courses) {
  return [...new Map(courses.filter(Boolean).map((course) => [course.id, course])).values()];
}

function programShape(level, academyCourses, sharedCourses, trackIndex) {
  if (level === "SHORT") {
    const starts = [[0, 1], [2, 4, 5], [6, 7, 9]];
    return uniqueCourses(starts[trackIndex].map((index) => academyCourses[index]));
  }
  if (level === "ASSOCIATE") {
    const ownCount = 8 + trackIndex;
    return uniqueCourses([...academyCourses.slice(0, ownCount), ...sharedCourses.slice(trackIndex * 2, trackIndex * 2 + 2)]).slice(0, 12);
  }
  return uniqueCourses([...academyCourses, ...sharedCourses.slice(trackIndex * 4), ...sharedCourses.slice(0, trackIndex * 4)]).slice(0, 16 + trackIndex * 4);
}

try {
  const courseMatrix = [];
  let courseCount = 0;
  let dayCount = 0;

  await db.valueRateSchedule.upsert({
    where: { id: "efu-value-2026" },
    update: { active: true },
    create: {
      id: "efu-value-2026",
      name: "2026 Sponsored Learning Schedule",
      hourlyInstructionCents: 22500,
      labServicesCents: 80000,
      aiAssessmentCents: 120000,
      studioServicesCents: 160000,
      credentialAdminCents: 30000,
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    },
  });

  for (let academyIndex = 0; academyIndex < academies.length; academyIndex++) {
    const [academy, editor, subjects] = academies[academyIndex];
    const academyCourses = [];
    let previous = null;
    for (let subjectIndex = 0; subjectIndex < subjects.length; subjectIndex++) {
      const subject = subjects[subjectIndex];
      const estimatedDays = durations[subjectIndex];
      const workloadHours = estimatedDays * 7;
      const serviceValueCents = workloadHours * 22500 + 80000 + 120000 + 160000 + (levels[subjectIndex] === "CAPSTONE" ? 30000 : 0);
      const code = `EFU-${String(academyIndex + 1).padStart(2, "0")}${String(subjectIndex + 1).padStart(2, "0")}`;
      const legacyCode = subjectIndex < 4 ? `EFU-${String(academyIndex + 1).padStart(2, "0")}${subjectIndex + 1}` : null;
      const source = wikiTitle(subject);
      const url = sourceUrl(source);
      const legacy = legacyCode ? await db.course.findUnique({ where: { code: legacyCode } }) : null;
      const course = legacy
        ? await db.course.update({
            where: { id: legacy.id },
            data: { title: subject, academy, estimatedDays, workloadHours, serviceValueCents, wikiManaged: true, status: "PUBLISHED", outcomes: [`Operate ${editor} safely`, `Apply official guidance to ${subject}`, "Validate and document a repeatable result"] },
          })
        : await db.course.upsert({
            where: { code },
            update: { title: subject, academy, estimatedDays, workloadHours, serviceValueCents, wikiManaged: true, status: "PUBLISHED", outcomes: [`Operate ${editor} safely`, `Apply official guidance to ${subject}`, "Validate and document a repeatable result"] },
            create: { code, title: subject, summary: `A complete ${estimatedDays}-day studio course in ${subject}, grounded in current Bohemia Interactive technical guidance.`, deliverable: `Complete the ${subject} practical build, validation record, reflection log, and studio-ready demonstration.`, studio, level: levels[subjectIndex], status: "PUBLISHED", learningCredits: Math.max(2, Math.ceil(estimatedDays / 4)), serviceValueCents, academy, estimatedDays, workloadHours, wikiManaged: true, outcomes: [`Operate ${editor} safely`, `Apply official guidance to ${subject}`, "Validate and document a repeatable result"] },
          });

      await db.curriculumSource.upsert({
        where: { wikiTitle: source },
        update: { url, courseId: course.id },
        create: { wikiTitle: source, url, sourceExcerpt: `Official technical source supporting the ${subject} course.`, courseId: course.id },
      });
      await db.gradingRubric.upsert({
        where: { courseId: course.id },
        update: {},
        create: {
          courseId: course.id,
          criteria: [
            { id: "technical", label: "Technical correctness", weight: 35 },
            { id: "evidence", label: "Reproducible evidence", weight: 25 },
            { id: "workbench", label: "Workbench process", weight: 20 },
            { id: "reflection", label: "Development reflection", weight: 10 },
            { id: "sources", label: "Source alignment", weight: 10 },
          ],
        },
      });

      const courseDays = Array.from({ length: estimatedDays }, (_, index) => ({ courseId: course.id, ...makeDay({ subject, editor, dayNumber: index + 1, days: estimatedDays, source }) }));
      await db.courseDay.createMany({ data: courseDays, skipDuplicates: true });
      dayCount += courseDays.length;
      if (previous) await db.coursePrerequisite.upsert({ where: { courseId_prerequisiteId: { courseId: course.id, prerequisiteId: previous } }, update: {}, create: { courseId: course.id, prerequisiteId: previous } });
      previous = course.id;
      academyCourses.push(course);
      courseCount++;
    }
    courseMatrix.push(academyCourses);
  }

  let programCount = 0;
  for (let academyIndex = 0; academyIndex < academies.length; academyIndex++) {
    const [academy] = academies[academyIndex];
    const own = courseMatrix[academyIndex];
    const shared = uniqueCourses([
      ...courseMatrix[2],
      ...courseMatrix[0],
      ...courseMatrix[15],
      ...courseMatrix[(academyIndex + 1) % courseMatrix.length],
    ]).filter((course) => !own.some((item) => item.id === course.id));

    for (const [levelIndex, level] of ["SHORT", "ASSOCIATE", "BACHELOR"].entries()) {
      for (let trackIndex = 0; trackIndex < programTracks.length; trackIndex++) {
        const track = programTracks[trackIndex];
        const required = programShape(level, own, shared, trackIndex);
        const code = `EFU-P${String(academyIndex + 1).padStart(2, "0")}-${level[0]}${trackIndex + 1}`;
        const levelLabel = level === "SHORT" ? "Professional Certificate" : level === "ASSOCIATE" ? "Associate Program" : "Bachelor's Program";
        const credentialTitle = level === "SHORT" ? `${academy} ${track} Certificate` : `${academy} ${track} Program Completion Credential`;
        const program = await db.academicProgram.upsert({
          where: { code },
          update: { academy, level, active: true, creditsRequired: required.reduce((sum, course) => sum + course.learningCredits, 0), estimatedValueCents: required.reduce((sum, course) => sum + course.serviceValueCents, 0), credentialTitle },
          create: {
            code,
            title: `${levelLabel} in ${academy}: ${track}`,
            summary: `A structured ${academy.toLowerCase()} pathway combining guided coursework, technical evidence, studio practice, and a final applied outcome.`,
            level,
            academy,
            durationDays: level === "SHORT" ? 120 : level === "ASSOCIATE" ? 480 : 960,
            creditsRequired: required.reduce((sum, course) => sum + course.learningCredits, 0),
            estimatedValueCents: required.reduce((sum, course) => sum + course.serviceValueCents, 0),
            credentialTitle,
            sponsoredBy: studio,
          },
        });
        for (let index = 0; index < required.length; index++) {
          const course = required[index];
          const type = index === required.length - 1 ? "CAPSTONE" : own.some((item) => item.id === course.id) ? "CORE" : index % 3 === 0 ? "ELECTIVE" : "SUPPORTING";
          await db.programCourseRequirement.upsert({
            where: { programId_courseId: { programId: program.id, courseId: course.id } },
            update: { type, sequence: index + 1, termNumber: Math.floor(index / 4) + 1 },
            create: { programId: program.id, courseId: course.id, type, sequence: index + 1, termNumber: Math.floor(index / 4) + 1 },
          });
        }
        programCount++;
      }
    }
  }

  console.log(`[curriculum] ${courseCount} courses, ${programCount} programs, and ${dayCount} course days are ready across ${academies.length} academies.`);
} finally {
  await db.$disconnect();
}
