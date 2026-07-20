import { db } from "@/lib/db";
import type { StudioBlock } from "@/lib/curriculum-compiler";

function array(value: unknown) { return Array.isArray(value) ? value.map(String) : []; }

type LegacyStep = {
  instruction: string;
  expectedResult: string;
  why: string;
  sectionAnchor: string;
};

const animationFoundationDays: LegacyStep[][] = [
  [
    { instruction: "Launch Arma Reforger Tools and open your disposable training project. Wait for Resource Manager and the Log Console to finish loading before continuing.", expectedResult: "Resource Manager shows your training addon as the writable project and no new red error is appearing repeatedly in the Log Console.", why: "Working in a separate addon protects base-game resources and gives every saved file a clear owner.", sectionAnchor: "Resource_Manager" },
    { instruction: "From Resource Manager, open Editors and choose Animation Editor. If the editor opens with a different layout, use View to show Workspace, Anim Set, Animation Graph, Controls, Preview, and Errors.", expectedResult: "The Animation Editor is open and all six working panels are visible or available as tabs.", why: "These panels form the complete workspace you will use to build, preview, control, and diagnose animation logic.", sectionAnchor: "Animation_Editor_interface" },
    { instruction: "Locate the top-bar controls for New Workspace, Open Workspace, Save Workspace, Play, Stop, and Errors. Hover each control and compare its tooltip with the toolbar description in the source.", expectedResult: "You can point to the controls used to create, save, run, stop, and diagnose a workspace.", why: "Learning these controls first prevents students from changing graph content before they know how to recover or inspect a failure.", sectionAnchor: "Toolbar" },
    { instruction: "In the Preview panel, drag with the left and right mouse buttons to test the two camera rotations. Return the camera to a readable view before moving on.", expectedResult: "The preview camera responds to both rotations without changing any animation resource.", why: "A controlled preview view makes later visual verification much easier.", sectionAnchor: "Anim_Editor_Preview" },
    { instruction: "Save a development note naming every visible panel and write down the first warning or error currently shown. If there is no warning, record that the console is clear.", expectedResult: "Your lesson notes contain a panel inventory and a specific starting diagnostic state.", why: "A recorded baseline lets you distinguish pre-existing messages from errors introduced by your own work.", sectionAnchor: "Log_Console" },
  ],
  [
    { instruction: "Choose File > Open Workspace, or press Ctrl+O, and open a training or sample animation workspace that you are permitted to inspect.", expectedResult: "The workspace name appears in Animation Editor and its Workspace tree is populated.", why: "A populated workspace lets you study the relationship between templates, instances, sheets, sync events, and preview models before creating your own.", sectionAnchor: "Top_Bar" },
    { instruction: "In the Workspace panel, expand Anim Template, Instances, Sheets, Sync Table, and Preview Models one group at a time.", expectedResult: "You can identify at least one existing resource under each populated category and note which categories are empty.", why: "The tree is the structural map of an animation workspace; reading it first prevents misplaced resources.", sectionAnchor: "Workspace" },
    { instruction: "Select an animation instance, then inspect the Anim Set. Identify its groups, rows, columns, assigned green dots, and unassigned grey dots without changing them.", expectedResult: "The Anim Set reflects the selected instance and you can distinguish assigned from missing animation cells.", why: "Instances fill a shared template with a specific animation set, so selection changes what the table represents.", sectionAnchor: "Anim_Set" },
    { instruction: "Select a sheet and use the center-view control in Animation Graph. Pan with the middle mouse button and zoom with the wheel until the whole graph is readable.", expectedResult: "The selected sheet is visible as an organized node graph and no nodes were moved or edited.", why: "Graph navigation must be comfortable before you create or connect logic.", sectionAnchor: "Animation_Graph" },
    { instruction: "Open Errors and Log Console, record the first message in each, then close the workspace without saving any accidental changes.", expectedResult: "Your notes contain the inspected workspace state and the original asset remains unchanged.", why: "Read-only inspection builds diagnostic skill without risking a sample or shared resource.", sectionAnchor: "Errors" },
  ],
  [
    { instruction: "Press Ctrl+N to create a new animation workspace, then immediately save it inside your training addon's animation folder with a descriptive name.", expectedResult: "The new workspace reloads from an addon-owned path and the title bar no longer shows an unsaved workspace.", why: "Saving first establishes a stable resource path before dependent files are created.", sectionAnchor: "Top_Bar" },
    { instruction: "In Workspace, right-click Anim Template, create a template, and name it training_template.", expectedResult: "training_template appears beneath Anim Template in the Workspace tree.", why: "The template defines the reusable animation slots that instances will fill.", sectionAnchor: "Templates_and_Instances" },
    { instruction: "Right-click Instances, create an instance, and name it training_unarmed. Select it after creation.", expectedResult: "training_unarmed is selected and the Anim Set is ready to display values for that instance.", why: "An instance supplies a concrete set of animations to the generic template.", sectionAnchor: "Templates_and_Instances" },
    { instruction: "Right-click Sheets, create a sheet named Foundation, and select it so the Animation Graph displays that sheet.", expectedResult: "Foundation appears beneath Sheets and opens as the active graph page.", why: "Sheets keep graph logic divided into readable working areas as a system grows.", sectionAnchor: "Workspace" },
    { instruction: "Press Ctrl+S, close the workspace, reopen it with Ctrl+O, and confirm the template, instance, and sheet are still present.", expectedResult: "All three resources survive a close-and-reopen test with the same names.", why: "Reloading proves the structure was saved rather than existing only in the current editor session.", sectionAnchor: "Top_Bar" },
  ],
  [
    { instruction: "Open the training workspace and right-click Preview Models in the Workspace panel to add a permitted character or other compatible preview model.", expectedResult: "A model entry appears beneath Preview Models.", why: "Animation Editor needs a preview model to show movement and may report an error when one is missing.", sectionAnchor: "Preview_Model" },
    { instruction: "Select the added preview model and confirm it appears in Anim Editor Preview. If it does not, open Errors before changing anything else.", expectedResult: "The selected model is visible, or an exact error identifies why it cannot be displayed.", why: "Checking the first failure preserves a useful diagnostic signal.", sectionAnchor: "Anim_Editor_Preview" },
    { instruction: "Rotate around the model with the left mouse button, rotate the camera axis with the right mouse button, and frame a view where the full model is visible.", expectedResult: "The model remains loaded and the preview is framed for observing motion.", why: "A consistent camera position makes before-and-after animation comparisons reliable.", sectionAnchor: "Anim_Editor_Preview" },
    { instruction: "Select the training_unarmed instance and inspect the Anim Set for empty cells. Do not assign an animation unless the course source identifies the correct template slot.", expectedResult: "You can identify missing assignments without placing an animation in an unsupported slot.", why: "The instance must match the template; guessing at a slot creates misleading graph failures.", sectionAnchor: "Anim_Set" },
    { instruction: "Save, reopen the workspace, and record whether the preview model and selected instance return correctly.", expectedResult: "The workspace reopens with its structural resources intact and the preview can be restored without recreating the setup.", why: "A reload test verifies that the workspace is ready for graph work.", sectionAnchor: "Workspace" },
  ],
  [
    { instruction: "Open the training workspace, select the Foundation sheet, and check Errors before pressing Play.", expectedResult: "You have a recorded pre-run error state and the intended sheet is visible.", why: "A pre-run baseline prevents new runtime messages from being confused with existing setup issues.", sectionAnchor: "Errors" },
    { instruction: "If the graph contains a valid node, right-click it and set it as the default running node. If no valid node exists, record that result and do not invent one for this foundations check.", expectedResult: "A valid default is selected, or your notes accurately state that playback is unavailable because the workspace has no runnable node.", why: "The Play command does nothing when no default node is configured.", sectionAnchor: "Animation_Graph" },
    { instruction: "Press Play on the toolbar and watch Anim Editor Preview, Controls, and Log Console together for one complete test cycle.", expectedResult: "The graph runs from its default node, or the first specific blocking message is visible in Errors or Log Console.", why: "Watching output and diagnostics together connects graph state to visible behavior.", sectionAnchor: "Toolbar" },
    { instruction: "Press Stop, open Errors, and compare the result with your pre-run baseline. Record only messages that appeared during this test.", expectedResult: "Your notes separate new playback findings from the workspace's starting state.", why: "Change-based diagnosis is faster and more reliable than copying an entire console.", sectionAnchor: "Errors" },
    { instruction: "Save the workspace and write a five-line handoff: path, template, active instance, active sheet, and verified playback result.", expectedResult: "Another student could reopen the same workspace and repeat your verification from the handoff.", why: "Reproducible evidence is the completion standard for the foundations studio.", sectionAnchor: "Log_Console" },
  ],
];

function legacyProcedure(course: { title: string; academy: string }, day: { dayNumber: number; workbenchSteps: unknown }): LegacyStep[] {
  if (course.academy === "Animation" && course.title === "Animation Foundations") return animationFoundationDays[Math.min(animationFoundationDays.length - 1, day.dayNumber - 1)];
  const supplied = array(day.workbenchSteps);
  const editor = course.academy.includes("Script") || course.academy.includes("Replication") ? "Script Editor" : course.academy.includes("Audio") ? "Audio Editor" : course.academy.includes("Animation") ? "Animation Editor" : course.academy.includes("Resource") || course.academy.includes("Workbench") ? "Resource Manager" : "World Editor";
  return supplied.map((instruction, index) => ({
    instruction: `${instruction} Before continuing, identify the exact ${editor} control or resource named by the mapped source and perform only that single change.`,
    expectedResult: index === supplied.length - 1 ? `The ${course.title} exercise produces a repeatable visible result and no new unresolved error.` : `The ${editor} shows the expected state for this operation; save or record it before proceeding.`,
    why: "One observable change at a time makes the workflow repeatable and gives troubleshooting a clear starting point.",
    sectionAnchor: "",
  }));
}

export function legacyStudioBlocks(day: { id: string; dayNumber: number; instructionalText: string; sourceSection: string; workbenchSteps: unknown; practicalLab: string; completionChecklist: unknown }, course: { title: string; academy: string }, source?: { id: string; latestSnapshotId?: string | null }) {
  const steps = legacyProcedure(course, day).map((step, index) => ({ id: `legacy-step-${index + 1}`, instruction: step.instruction, mandatory: true, expectedResult: step.expectedResult, why: step.why, sourceRef: { sourceId: source?.id || "legacy", snapshotId: source?.latestSnapshotId || "legacy", sectionAnchor: step.sectionAnchor || "lesson-source" } }));
  return [
    { id: "concept", type: "CONCEPT", title: "Why today's build matters", body: day.instructionalText },
    { id: "requirements", type: "REQUIREMENTS", title: "Get ready", items: ["Open Arma Reforger Tools and your writable training addon.", "Keep Resource Manager and Log Console visible.", "Open the mapped technical reference beside Workbench."] },
    { id: "procedure", type: "PROCEDURE", title: "Follow these steps in Workbench", steps },
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
    const blocks = version ? version.structuredContent as unknown as StudioBlock[] : legacyStudioBlocks(day, { title: course.title, academy: course.academy }, { id: firstSource?.id || "legacy", latestSnapshotId: firstSource?.snapshots[0]?.id });
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
