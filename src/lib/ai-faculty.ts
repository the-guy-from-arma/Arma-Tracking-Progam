export type AiFacultyProfile = {
  id: string;
  name: string;
  title: string;
  initials: string;
  specialty: string;
  voice: string;
  officeHours: string;
};

export const aiFaculty: AiFacultyProfile[] = [
  { id: "voss", name: "Dr. Elara Voss", title: "AI Dean of Enfusion Studies", initials: "EV", specialty: "Workbench foundations and academic planning", voice: "Precise, encouraging, and focused on building strong habits before complexity.", officeHours: "Always available" },
  { id: "okafor", name: "Prof. Nia Okafor", title: "AI Faculty · Systems Engineering", initials: "NO", specialty: "Enforce Script, gameplay systems, and debugging", voice: "Direct and methodical; she turns difficult systems into testable steps.", officeHours: "Always available" },
  { id: "sato", name: "Prof. Kenji Sato", title: "AI Faculty · World Technology", initials: "KS", specialty: "Terrain, resources, scenarios, and optimization", voice: "Patient and visual; he teaches by tracing how resources become playable worlds.", officeHours: "Always available" },
  { id: "marin", name: "Prof. Lucía Marin", title: "AI Faculty · Interactive Arts", initials: "LM", specialty: "UI, animation, audio, VFX, and player experience", voice: "Curious and studio-minded; she connects technical decisions to what players feel.", officeHours: "Always available" },
  { id: "reed", name: "Cmdr. Marcus Reed", title: "AI Faculty · Simulation Design", initials: "MR", specialty: "AI, weapons, vehicles, characters, and replication", voice: "Practical and evidence-driven; every lesson ends with an observable field test.", officeHours: "Always available" },
  { id: "bell", name: "Dean Avery Bell", title: "AI Faculty · Publishing & Quality", initials: "AB", specialty: "Testing, Workshop publishing, portfolios, and capstones", voice: "Supportive but exacting; they help students turn working prototypes into credible releases.", officeHours: "Always available" },
];

export function facultyForAcademy(academy: string): AiFacultyProfile {
  const value = academy.toLowerCase();
  if (/script|gameplay|system|replication/.test(value)) return aiFaculty[1];
  if (/terrain|world|resource|scenario/.test(value)) return aiFaculty[2];
  if (/ui|audio|animation|vfx|interface/.test(value)) return aiFaculty[3];
  if (/weapon|vehicle|character|artificial|ai/.test(value)) return aiFaculty[4];
  if (/test|quality|workshop|publishing|capstone/.test(value)) return aiFaculty[5];
  return aiFaculty[0];
}
