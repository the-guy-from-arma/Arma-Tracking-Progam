import { db } from "@/lib/db";
import type { StudioBlock } from "@/lib/curriculum-compiler";

function array(value: unknown) { return Array.isArray(value) ? value.map(String) : []; }

export function legacyStudioBlocks(day: { id: string; instructionalText: string; sourceSection: string; workbenchSteps: unknown; practicalLab: string; completionChecklist: unknown }, source?: { id: string; latestSnapshotId?: string | null }) {
  const steps = array(day.workbenchSteps).map((instruction, index) => ({ id: `legacy-step-${index + 1}`, instruction, mandatory: true, expectedResult: "The Workbench state matches the procedure before you continue.", why: "Verifying one controlled change at a time keeps the result diagnosable.", sourceRef: { sourceId: source?.id || "legacy", snapshotId: source?.latestSnapshotId || "legacy", sectionAnchor: "legacy-source" } }));
  return [
    { id: "concept", type: "CONCEPT", title: "Studio briefing", body: day.instructionalText },
    { id: "requirements", type: "REQUIREMENTS", title: "Before you begin", items: ["Open a disposable training addon.", "Save a backup of the resource you will change.", "Keep the mapped Bohemia Wiki source open for verification."] },
    { id: "procedure", type: "PROCEDURE", title: "Workbench procedure", steps },
    { id: "expected", type: "EXPECTED_RESULT", title: "Expected result", body: "Your controlled training resource should load without a new Workbench error and visibly reflect the intended change." },
    { id: "verify", type: "VERIFICATION", title: "Verify before continuing", items: ["Reopen the edited resource.", "Inspect the Workbench console for new errors.", "Record the visible result in your development notes."] },
    { id: "troubleshooting", type: "TROUBLESHOOTING", title: "If this does not work", items: ["Undo the most recent change and repeat that step.", "Confirm resource names, paths, and dependencies against the mapped source.", "Capture the exact console message before asking faculty for help."] },
    { id: "lab", type: "LAB", title: "Practical lab", body: day.practicalLab },
    { id: "checklist", type: "CHECKLIST", title: "Completion checklist", items: array(day.completionChecklist) },
    { id: "source", type: "SOURCE", title: "Technical source", body: day.sourceSection },
  ] satisfies StudioBlock[];
}

function publicQuiz(value: unknown, fallbackQuestion: string) {
  const quiz = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return { id: String(quiz.id || "legacy-check"), type: String(quiz.type || "SHORT_RESPONSE"), prompt: String(quiz.prompt || fallbackQuestion), options: array(quiz.options), explanation: String(quiz.explanation || "Review the lesson evidence and compare your response to the procedure."), version: String(quiz.version || "legacy-v1") };
}

export async function getCourseStudio(courseId: string, userId: string) {
  const course = await db.course.findUnique({ where: { id: courseId }, include: {
    prerequisites: { include: { prerequisite: { select: { id: true, code: true, title: true } } } },
    enrollments: { where: { userId } },
    sourceMappings: { include: { source: { include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 1, include: { media: { orderBy: { displayOrder: "asc" } } } } } } } },
    days: { orderBy: { dayNumber: "asc" }, include: {
      progress: { where: { userId } },
      activeContentVersion: { include: { sourceLinks: { include: { source: { select: { id: true, wikiTitle: true, url: true, revisionId: true, syncStatus: true } }, snapshot: { include: { media: { orderBy: { displayOrder: "asc" } } } } } } } },
    } },
  } });
  if (!course) return null;
  const firstSource = course.sourceMappings[0]?.source;
  const normalizedDays = course.days.map((day) => {
    const version = day.activeContentVersion;
    const links = version?.sourceLinks || [];
    const linkedMedia = [...new Map(links.flatMap((link) => link.snapshot.media).map((media) => [media.id, media])).values()];
    const blocks = version ? version.structuredContent as unknown as StudioBlock[] : legacyStudioBlocks(day, { id: firstSource?.id || "legacy", latestSnapshotId: firstSource?.snapshots[0]?.id });
    return {
      id: day.id, dayNumber: day.dayNumber, title: version?.title || day.title, objectives: version ? array(version.objectives) : array(day.objectives), estimatedMinutes: version?.estimatedMinutes || Math.max(45, Math.round(course.workloadHours * 60 / Math.max(1, course.estimatedDays))),
      blocks, quiz: publicQuiz(version?.quizDefinition, day.knowledgeQuestion), reflectionPrompt: version?.reflectionPrompt || day.reflectionPrompt,
      version: version ? { id: version.id, number: version.version, publishedAt: version.publishedAt, materiallyChanged: version.materiallyChanged } : null,
      sources: links.length ? links.map((link) => ({ id: link.source.id, title: link.source.wikiTitle, url: link.source.url, revisionId: link.snapshot.revisionId, sectionAnchor: link.sectionAnchor, status: link.source.syncStatus })) : course.sourceMappings.map((mapping) => ({ id: mapping.source.id, title: mapping.source.wikiTitle, url: mapping.source.url, revisionId: mapping.source.revisionId, sectionAnchor: "", status: mapping.source.syncStatus })),
      media: linkedMedia.length ? linkedMedia : firstSource?.snapshots[0]?.media || [], progress: day.progress[0] || null,
    };
  });
  return {
    id: course.id, code: course.code, title: course.title, summary: course.summary, deliverable: course.deliverable, studio: course.studio, level: course.level, academy: course.academy,
    estimatedDays: course.estimatedDays, workloadHours: course.workloadHours, learningCredits: course.learningCredits, outcomes: array(course.outcomes), prerequisites: course.prerequisites,
    enrollment: course.enrollments[0] || null, days: normalizedDays,
    sources: course.sourceMappings.map((mapping) => ({ id: mapping.source.id, title: mapping.source.wikiTitle, url: mapping.source.url, revisionId: mapping.source.revisionId, status: mapping.source.syncStatus, lastSyncedAt: mapping.source.lastSyncedAt, mediaCount: mapping.source.snapshots[0]?.media.length || 0 })),
  };
}

export function gradeKnowledgeCheck(definition: unknown, response: unknown, fallbackAnswer: string) {
  const quiz = definition && typeof definition === "object" ? definition as Record<string, unknown> : {};
  const type = String(quiz.type || "SHORT_RESPONSE");
  const normalize = (value: unknown) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  let score = 0;
  if (type === "MULTIPLE_CHOICE") score = normalize(response) === normalize(quiz.correctAnswer) ? 100 : 0;
  else if (type === "ORDERING") {
    const answer = Array.isArray(response) ? response.map(normalize) : [];
    const correct = Array.isArray(quiz.correctAnswer) ? quiz.correctAnswer.map(normalize) : [];
    score = correct.length && correct.every((item, index) => answer[index] === item) ? 100 : 0;
  } else if (type === "IDENTIFICATION") {
    const acceptable = array(quiz.acceptableAnswers).map(normalize);
    score = acceptable.some((answer) => answer && normalize(response).includes(answer)) ? 100 : 0;
  } else {
    const required = array(quiz.requiredKeywords).length ? array(quiz.requiredKeywords).map(normalize) : normalize(fallbackAnswer).split(/[^a-z0-9]+/).filter((word) => word.length > 4).slice(0, 5);
    const answer = normalize(response);
    const hits = required.filter((word) => answer.includes(word)).length;
    score = required.length ? Math.round((hits / required.length) * 100) : answer.length >= 80 ? 75 : answer.length >= 30 ? 50 : 0;
  }
  return { score, correct: score >= 70, type, version: String(quiz.version || "legacy-v1") };
}
