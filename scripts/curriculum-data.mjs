export const academies = [
  ["Workbench Foundations", "Resource Manager", ["Mod Project Setup", "Workbench Interface and Editors", "Project Dependencies", "Publishing a First Addon"]],
  ["Resource Management", "Resource Manager", ["Resource Browser and Data Structure", "Prefab Foundations", "Configuration Files", "Resource Validation and GUIDs"]],
  ["Enforce Scripting", "Script Editor", ["Enforce Script Syntax", "Object-Oriented Programming", "Scripting Conventions", "Script Modding and Overrides"]],
  ["Gameplay Systems", "World Editor", ["Entity Components", "User Actions", "Game Modes and Services", "Gameplay Systems Capstone"]],
  ["Multiplayer Replication", "Script Editor", ["Authority and Ownership", "Replication Basics", "Remote Procedure Calls", "Multiplayer Reliability Capstone"]],
  ["World and Terrain", "World Editor", ["World Editor Foundations", "Terrain Creation", "Layers Roads and Biomes", "Playable World Capstone"]],
  ["Artificial Intelligence", "World Editor", ["AI Foundations", "Navmesh Generation", "AI Waypoints and Behavior", "AI Scenario Capstone"]],
  ["Interface and Localization", "Workbench", ["UI Layout Foundations", "Widgets and Event Handling", "Localization Tables", "Accessible Interface Capstone"]],
  ["Audio Production", "Audio Editor", ["Audio Editor Foundations", "Signals Nodes and Shaders", "Entity Sound Integration", "Interactive Audio Capstone"]],
  ["Animation", "Animation Editor", ["Animation Foundations", "Animation Graphs", "Procedural Animation", "Character Animation Capstone"]],
  ["VFX and Materials", "Particle Editor", ["Material Foundations", "Textures and Import", "Particles and Effects", "VFX Integration Capstone"]],
  ["Weapons", "World Editor", ["Weapon Modding", "Weapon Asset Preparation", "Optics Collimators and Attachments", "Production Weapon Capstone"]],
  ["Vehicles", "World Editor", ["Vehicle Modding", "Vehicle Asset Preparation", "Simulation Components", "Production Vehicle Capstone"]],
  ["Characters and Factions", "World Editor", ["Character Gear Foundations", "Rigging and Protection", "Faction Creation", "Playable Faction Capstone"]],
  ["Scenarios and Game Master", "World Editor", ["Scenario Framework", "Game Master Integration", "Tasks Respawn and Objectives", "Multiplayer Scenario Capstone"]],
  ["Quality and Publishing", "Workbench", ["Debugging and Diagnostics", "Performance and Optimization", "Workshop Publishing", "Release Readiness Capstone"]],
];

export function wikiTitle(subject) {
  const explicit = {
    "Mod Project Setup": "Arma Reforger:Mod Project Setup", "Resource Browser and Data Structure": "Arma Reforger:Data Modding Basics",
    "Prefab Foundations": "Arma Reforger:Prefabs Basics", "Enforce Script Syntax": "Arma Reforger:Enforce Script Syntax",
    "Scripting Conventions": "Arma Reforger:Scripting: Conventions", "Script Modding and Overrides": "Arma Reforger:Scripting Modding",
    "Navmesh Generation": "Arma Reforger:Navmesh Tutorial", "Audio Editor Foundations": "Arma Reforger:Audio Editor: Getting Started Tutorial",
    "Procedural Animation": "Arma Reforger:Procedural Animation Editor Basics Tutorial", "Weapon Modding": "Arma Reforger:Weapon Modding",
    "Weapon Asset Preparation": "Arma Reforger:Weapon Creation/Asset Preparation", "Vehicle Modding": "Arma Reforger:Car Modding",
    "Vehicle Asset Preparation": "Arma Reforger:Car Creation/Asset Preparation", "Faction Creation": "Arma Reforger:Faction Creation",
    "Game Master Integration": "Arma Reforger:Game Master Tutorial", "Workshop Publishing": "Arma Reforger:Workshop",
  };
  return explicit[subject] || `Arma Reforger:${subject}`;
}

export function sourceUrl(title) { return `https://community.bohemia.net/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`; }

const stages = ["Orient", "Inspect", "Reproduce", "Isolate", "Configure", "Implement", "Validate", "Debug", "Integrate", "Document", "Extend", "Test", "Review", "Polish", "Demonstrate", "Harden", "Benchmark", "Package", "Present", "Reflect"];

export function makeDay({ subject, editor, dayNumber, days, source }) {
  const stage = stages[dayNumber - 1] || `Studio ${dayNumber}`;
  return {
    dayNumber,
    title: `${stage}: ${subject}`,
    objectives: [`Explain the ${stage.toLowerCase()} phase for ${subject}.`, `Complete a repeatable ${editor} workflow.`, "Record evidence and a troubleshooting observation."],
    instructionalText: `Today moves ${subject} from explanation into controlled practice. Work in a disposable training addon, compare each change against the official Bohemia source, and make one change at a time so the result can be diagnosed. Day ${dayNumber} of ${days} emphasizes ${stage.toLowerCase()}, evidence, and a clean handoff to the next session.`,
    sourceSection: `Use ${source} as the technical authority for this lesson. Confirm the current page warnings, prerequisites, naming, and editor-specific instructions before beginning the lab.`,
    workbenchSteps: [
      "Launch Arma Reforger Tools and open the assigned training addon rather than the read-only game project.",
      `Open ${editor} from Workbench and locate the resources associated with ${subject}.`,
      "Duplicate or inherit the required resource inside the training addon; do not alter base-game data.",
      `Apply the Day ${dayNumber} ${stage.toLowerCase()} change and save after each logically complete operation.`,
      "Compile or validate the project, resolve every new error, and test the behavior in an isolated scenario.",
      "Capture the resource path, test result, and one lesson learned in the development record.",
    ],
    practicalLab: `Create a small, reversible ${subject} exercise demonstrating the ${stage.toLowerCase()} phase. The result must load without new errors and include a written test case.`,
    completionChecklist: ["Training addon opens", "Resources live inside the addon", "Validation completes", "Behavior is tested", "Development record is updated"],
    knowledgeQuestion: `What evidence proves that the Day ${dayNumber} ${subject} change is isolated, valid, and ready to continue?`,
    knowledgeAnswer: "A clean validation result, a reproducible test, an addon-owned resource path, and a written observation provide the required evidence.",
    reflectionPrompt: `Describe the most important ${subject} decision you made today, what evidence supported it, and what you will verify on Day ${Math.min(days, dayNumber + 1)}.`,
  };
}
