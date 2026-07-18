import { db } from "@/lib/db";

type Requirement = {
  id: string;
  courseId: string;
  sequence: number;
  termNumber: number;
  course: { id: string; code: string; title: string; learningCredits: number };
};

type AuditableProgram = {
  id: string;
  level: string;
  academy: string;
  creditsRequired: number;
  requirements: Requirement[];
};

const priorLevel: Record<string, string | undefined> = {
  ASSOCIATE: "SHORT",
  BACHELOR: "ASSOCIATE",
};

export type ProgramAudit = {
  fulfilledCourseIds: string[];
  fulfilledRequirementIds: string[];
  fulfilledCourses: number;
  totalCourses: number;
  creditsApplied: number;
  creditsRequired: number;
  remainingCredits: number;
  progressPercent: number;
  nextCourseId: string | null;
  eligible: boolean;
  prerequisiteLevel: string | null;
  prerequisiteProgramId: string | null;
  blocker: string | null;
};

export async function getCompletedCourseIds(userId: string) {
  const [enrollments, certificates] = await Promise.all([
    db.courseEnrollment.findMany({
      where: { userId, status: "COMPLETED" },
      select: { courseId: true },
    }),
    db.certificate.findMany({ where: { userId }, select: { courseId: true } }),
  ]);
  return new Set([
    ...enrollments.map((item) => item.courseId),
    ...certificates.map((item) => item.courseId),
  ]);
}

export function buildProgramAudits(
  programs: AuditableProgram[],
  completedCourseIds: Set<string>,
  completedProgramIds: Set<string>,
) {
  const audits = new Map<string, ProgramAudit>();
  const completedEquivalents = new Set(completedProgramIds);

  // A finished requirement map is accepted as equivalent even if an older
  // enrollment record was never marked complete.
  for (const program of programs) {
    if (
      program.requirements.length > 0 &&
      program.requirements.every((item) => completedCourseIds.has(item.courseId))
    ) {
      completedEquivalents.add(program.id);
    }
  }

  for (const program of programs) {
    const ordered = [...program.requirements].sort(
      (a, b) => a.termNumber - b.termNumber || a.sequence - b.sequence,
    );
    const fulfilled = ordered.filter((item) =>
      completedCourseIds.has(item.courseId),
    );
    const creditsApplied = fulfilled.reduce(
      (total, item) => total + item.course.learningCredits,
      0,
    );
    const requiredLevel = priorLevel[program.level];
    const lowerPrograms = requiredLevel
      ? programs.filter(
          (candidate) =>
            candidate.academy === program.academy &&
            candidate.level === requiredLevel,
        )
      : [];
    const satisfiedPrior = lowerPrograms.find((candidate) =>
      completedEquivalents.has(candidate.id),
    );
    const eligible = !requiredLevel || Boolean(satisfiedPrior);
    const next = ordered.find((item) => !completedCourseIds.has(item.courseId));

    audits.set(program.id, {
      fulfilledCourseIds: [...new Set(fulfilled.map((item) => item.courseId))],
      fulfilledRequirementIds: fulfilled.map((item) => item.id),
      fulfilledCourses: fulfilled.length,
      totalCourses: ordered.length,
      creditsApplied,
      creditsRequired: program.creditsRequired,
      remainingCredits: Math.max(0, program.creditsRequired - creditsApplied),
      progressPercent: ordered.length
        ? Math.round((fulfilled.length / ordered.length) * 100)
        : 0,
      nextCourseId: next?.courseId || null,
      eligible,
      prerequisiteLevel: requiredLevel || null,
      prerequisiteProgramId: satisfiedPrior?.id || null,
      blocker: eligible
        ? null
        : `Complete a ${requiredLevel?.toLowerCase()} program in ${program.academy} before applying. Finished courses and certificates transfer automatically.`,
    });
  }
  return audits;
}

export async function getProgramAudit(userId: string, programId: string) {
  const [programs, completedCourseIds, completedEnrollments] = await Promise.all([
    db.academicProgram.findMany({
      where: { active: true },
      select: {
        id: true,
        level: true,
        academy: true,
        creditsRequired: true,
        requirements: {
          select: {
            id: true,
            courseId: true,
            sequence: true,
            termNumber: true,
            course: {
              select: {
                id: true,
                code: true,
                title: true,
                learningCredits: true,
              },
            },
          },
        },
      },
    }),
    getCompletedCourseIds(userId),
    db.programEnrollment.findMany({
      where: { userId, status: "COMPLETED" },
      select: { programId: true },
    }),
  ]);
  const audits = buildProgramAudits(
    programs,
    completedCourseIds,
    new Set(completedEnrollments.map((item) => item.programId)),
  );
  return audits.get(programId) || null;
}

export async function getProgramSequenceBlockers(
  userId: string,
  courseId: string,
  completedCourseIds: Set<string>,
) {
  const enrollments = await db.programEnrollment.findMany({
    where: {
      userId,
      status: "ACTIVE",
      program: { requirements: { some: { courseId } } },
    },
    select: {
      program: {
        select: {
          title: true,
          requirements: {
            select: {
              courseId: true,
              sequence: true,
              termNumber: true,
              course: { select: { code: true, title: true } },
            },
          },
        },
      },
    },
  });

  const blockers: string[] = [];
  for (const enrollment of enrollments) {
    const target = enrollment.program.requirements.find(
      (item) => item.courseId === courseId,
    );
    if (!target) continue;
    const earlier = enrollment.program.requirements.filter(
      (item) =>
        (item.termNumber < target.termNumber ||
          (item.termNumber === target.termNumber &&
            item.sequence < target.sequence)) &&
        !completedCourseIds.has(item.courseId),
    );
    for (const item of earlier) {
      blockers.push(`${item.course.code} ${item.course.title}`);
    }
  }
  return [...new Set(blockers)];
}

export async function refreshProgramProgress(userId: string) {
  const enrollments = await db.programEnrollment.findMany({
    where: { userId },
    select: { id: true, programId: true },
  });
  for (const enrollment of enrollments) {
    const audit = await getProgramAudit(userId, enrollment.programId);
    if (!audit) continue;
    const complete = audit.totalCourses > 0 && audit.fulfilledCourses === audit.totalCourses;
    await db.programEnrollment.update({
      where: { id: enrollment.id },
      data: {
        creditsEarned: audit.creditsApplied,
        status: complete ? "COMPLETED" : "ACTIVE",
        completedAt: complete ? new Date() : null,
      },
    });
  }
}
