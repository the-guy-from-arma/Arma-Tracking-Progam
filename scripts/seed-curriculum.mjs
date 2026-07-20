import { PrismaClient } from "@prisma/client";
import { academies, makeDay, sourceUrl, wikiTitle } from "./curriculum-data.mjs";

const db = new PrismaClient();
const studio = "Thunder Buddies Studios + Black Ridge Studios";
const durations = [5, 10, 15, 20, 5, 10, 10, 15, 15, 20, 20, 20];
const levels = ["FOUNDATION", "INTERMEDIATE", "ADVANCED", "CAPSTONE", "FOUNDATION", "INTERMEDIATE", "INTERMEDIATE", "ADVANCED", "ADVANCED", "CAPSTONE", "CAPSTONE", "CAPSTONE"];
const programProfiles = [
  { level: "SHORT", own: [0, 1], support: 0, target: 2, label: (academy, own) => `${own[0].title} Practitioner Certificate`, focus: (academy, own) => `Build a reliable entry-level workflow for ${own[0].title} and ${own[1].title}.`, audience: "New developers who want a focused first credential before committing to a longer pathway." },
  { level: "SHORT", own: [4, 5, 6], support: 1, target: 3, label: (academy, own) => `${own[4].title} Implementation Certificate`, focus: (academy, own) => `Move from guided configuration into applied ${own[4].title}, ${own[5].title}, and ${own[6].title} work.`, audience: "Developers with basic Workbench familiarity who want a practical specialization." },
  { level: "SHORT", own: [8, 9, 10, 11], support: 2, target: 4, label: (academy, own) => `${own[8].title} Studio Certificate`, focus: (academy, own) => `Produce, test, and present a portfolio-ready ${academy.toLowerCase()} artifact through ${own[8].title} and ${own[10].title}.`, audience: "Experienced learners seeking an intensive studio credential and reviewed portfolio artifact." },
  { level: "ASSOCIATE", own: [0, 1, 2, 4, 5, 6, 7, 11], support: 0, target: 10, label: (academy, own) => `Associate Program in ${own[2].title} and ${own[6].title}`, focus: (academy, own) => `Combine ${own[2].title}, ${own[6].title}, debugging, and cross-academy technical foundations.`, audience: "Developers preparing for dependable contributor-level technical work across a studio production cycle." },
  { level: "ASSOCIATE", own: [0, 3, 4, 5, 8, 9, 10, 11], support: 1, target: 11, label: (academy, own) => `Associate Program in Applied ${own[5].title} Production`, focus: (academy, own) => `Connect ${own[5].title} with ${own[8].title}, integration design, and player-facing production decisions.`, audience: "Applied creators who want to connect a specialist discipline to gameplay and player experience." },
  { level: "ASSOCIATE", own: [0, 2, 3, 6, 7, 8, 9, 10, 11], support: 2, target: 12, label: (academy, own) => `Associate Program in ${own[10].title} Practice`, focus: (academy, own) => `Plan and deliver ${own[10].title} through testing, release operations, and collaborative production practice.`, audience: "Developers moving toward feature ownership, production planning, and release responsibility." },
  { level: "BACHELOR", own: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], support: 0, target: 16, label: (academy) => `Bachelor's Program in ${academy} Technical Systems`, focus: (academy, own) => `Engineer maintainable ${academy.toLowerCase()} systems with strong scripting, resource, replication, and validation foundations.`, audience: "Advanced technical developers preparing to design, diagnose, and maintain production-scale systems." },
  { level: "BACHELOR", own: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], support: 1, target: 20, label: (academy, own) => `Bachelor's Program in ${own[8].title} and Integrated Design`, focus: (academy, own) => `Integrate ${own[8].title} with gameplay, interface, animation, visual effects, and user-centered design.`, audience: "Interdisciplinary developers seeking ownership of complete player-facing features and experiences." },
  { level: "BACHELOR", own: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], support: 2, target: 24, label: (academy) => `Bachelor's Program in ${academy} Production Leadership`, focus: (academy, own) => `Lead ${academy.toLowerCase()} production from project setup through ${own[11].title}, quality assurance, publishing, and team handoff.`, audience: "Senior contributors preparing for technical leadership, production coordination, and capstone direction." },
];

function uniqueCourses(courses) {
  return [...new Map(courses.filter(Boolean).map((course) => [course.id, course])).values()];
}

function courseNarrative(subject, editor, estimatedDays) {
  const lowered = subject.toLowerCase();
  const domain = /weapon|ballistic|muzzle|reload|optic/.test(lowered) ? "a testable armament feature" : /vehicle|wheel|track|turret|compartment/.test(lowered) ? "a driveable simulation feature" : /terrain|world|road|biome|forest|coast|water/.test(lowered) ? "a playable world region" : /audio|sound|mix|ambience/.test(lowered) ? "an interactive sound system" : /animation|motion|inverse|state machine/.test(lowered) ? "a responsive motion system" : /interface|ui|widget|hud|menu|localization|focus/.test(lowered) ? "an accessible player interface" : /script|code|component|callback|data type/.test(lowered) ? "a reusable Enforce implementation" : /replication|authority|network|rpc|prediction/.test(lowered) ? "a multiplayer-safe network feature" : /scenario|task|respawn|game master|spawn/.test(lowered) ? "a playable scenario flow" : /ai|navmesh|waypoint|formation|perception/.test(lowered) ? "a diagnosable AI behavior" : /material|texture|particle|vfx|decal|weather/.test(lowered) ? "an optimized visual effect" : "a validated Workbench feature";
  return {
    summary: `Design, build, diagnose, and document ${domain} through ${subject}. This ${estimatedDays}-day course moves from editor orientation to a reproducible implementation and evidence-based technical review.`,
    deliverable: `Produce ${domain} centered on ${subject}, including addon-owned resources, a repeatable test scenario, validation evidence, a source-aligned technical rationale, and a public demonstration or Workshop reference when available.`,
    outcomes: [`Build ${domain} with ${editor} using addon-owned resources.`, `Diagnose ${subject} failures with repeatable tests and Workbench evidence.`, `Explain the implementation against its mapped Bohemia Wiki source and present a studio-ready result.`],
  };
}

function programShape(profile, academyCourses, courseMatrix, academyIndex) {
  const supportAcademies = [[2, 1, 4, 15], [3, 7, 10, 9], [0, 14, 15, 6]][profile.support].filter((index) => index !== academyIndex);
  const support = uniqueCourses(supportAcademies.flatMap((index, position) => {
    const courses = courseMatrix[index] || [];
    const offset = (academyIndex + position * 3 + profile.support) % Math.max(1, courses.length);
    return [...courses.slice(offset), ...courses.slice(0, offset)];
  }));
  const culmination = academyCourses[profile.level === "SHORT" ? profile.own.at(-1) : 11];
  const own = profile.own.map((index) => academyCourses[index]).filter((course) => course && course.id !== culmination.id);
  return uniqueCourses([...own, ...support]).slice(0, profile.target - 1).concat(culmination).slice(0, profile.target);
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
      const code = `ESU-${String(academyIndex + 1).padStart(2, "0")}${String(subjectIndex + 1).padStart(2, "0")}`;
      const legacyCode = subjectIndex < 4 ? `ESU-${String(academyIndex + 1).padStart(2, "0")}${subjectIndex + 1}` : null;
      const source = wikiTitle(subject);
      const url = sourceUrl(source);
      const narrative = courseNarrative(subject, editor, estimatedDays);
      const legacy = legacyCode ? await db.course.findUnique({ where: { code: legacyCode } }) : null;
      const course = legacy
        ? await db.course.update({
            where: { id: legacy.id },
            data: { title: subject, summary: narrative.summary, deliverable: narrative.deliverable, academy, estimatedDays, workloadHours, serviceValueCents, wikiManaged: true, status: "PUBLISHED", outcomes: narrative.outcomes },
          })
        : await db.course.upsert({
            where: { code },
            update: { title: subject, summary: narrative.summary, deliverable: narrative.deliverable, academy, estimatedDays, workloadHours, serviceValueCents, wikiManaged: true, status: "PUBLISHED", outcomes: narrative.outcomes },
            create: { code, title: subject, summary: narrative.summary, deliverable: narrative.deliverable, studio, level: levels[subjectIndex], status: "PUBLISHED", learningCredits: Math.max(2, Math.ceil(estimatedDays / 4)), serviceValueCents, academy, estimatedDays, workloadHours, wikiManaged: true, outcomes: narrative.outcomes },
          });

      const curriculumSource = await db.curriculumSource.upsert({
        where: { wikiTitle: source },
        update: { url },
        create: { wikiTitle: source, url, sourceExcerpt: `Official technical source supporting the ${subject} course.` },
      });
      await db.courseSourceMapping.upsert({
        where: { courseId_sourceId: { courseId: course.id, sourceId: curriculumSource.id } },
        update: {},
        create: { courseId: course.id, sourceId: curriculumSource.id },
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
    for (const [profileIndex, profile] of programProfiles.entries()) {
        const trackIndex = profileIndex % 3;
        const level = profile.level;
        const required = programShape(profile, own, courseMatrix, academyIndex);
        const code = `ESU-P${String(academyIndex + 1).padStart(2, "0")}-${level[0]}${trackIndex + 1}`;
        const title = profile.label(academy, own);
        const focus = profile.focus(academy, own);
        const credentialTitle = level === "SHORT" ? title : `${title} Program Completion Credential`;
        const culminatingExperience = `Complete ${required.at(-1).title} with a studio-reviewed external demonstration, technical rationale, validation evidence, and development reflection.`;
        const learningOutcomes = [focus, `Apply ${required.filter((course) => course.academy !== academy).length} supporting courses from complementary academies.`, `Deliver ${required.at(-1).title} as the culminating assessed experience.`];
        const program = await db.academicProgram.upsert({
          where: { code },
          update: { title, summary: focus, academy, level, active: true, creditsRequired: required.reduce((sum, course) => sum + course.learningCredits, 0), estimatedValueCents: required.reduce((sum, course) => sum + course.serviceValueCents, 0), credentialTitle, audience: profile.audience, culminatingExperience, learningOutcomes },
          create: {
            code,
            title,
            summary: focus,
            level,
            academy,
            durationDays: level === "SHORT" ? 120 : level === "ASSOCIATE" ? 480 : 960,
            creditsRequired: required.reduce((sum, course) => sum + course.learningCredits, 0),
            estimatedValueCents: required.reduce((sum, course) => sum + course.serviceValueCents, 0),
            credentialTitle,
            audience: profile.audience,
            culminatingExperience,
            learningOutcomes,
            sponsoredBy: studio,
          },
        });
        await db.$transaction([
          db.programCourseRequirement.deleteMany({ where: { programId: program.id } }),
          db.programCourseRequirement.createMany({ data: required.map((course, index) => ({ programId: program.id, courseId: course.id, type: index === required.length - 1 ? "CAPSTONE" : own.some((item) => item.id === course.id) ? "CORE" : index % 3 === 0 ? "ELECTIVE" : "SUPPORTING", sequence: index + 1, termNumber: Math.floor(index / 4) + 1 })) }),
        ]);
        programCount++;
    }
  }

  console.log(`[curriculum] ${courseCount} courses, ${programCount} programs, and ${dayCount} course days are ready across ${academies.length} academies.`);
} finally {
  await db.$disconnect();
}
