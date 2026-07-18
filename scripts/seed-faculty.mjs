import { PrismaClient } from "@prisma/client";
import { facultyProfiles } from "./faculty-profiles.mjs";

const db = new PrismaClient();
try {
  for (const [slug, name, title, initials, academy, isPrimaryAdvisor, specialty, biography, teachingPhilosophy, voice] of facultyProfiles) {
    await db.facultyProfile.upsert({
      where: { slug },
      update: { name, title, initials, academy, isPrimaryAdvisor, specialty, biography, teachingPhilosophy, voice, active: true },
      create: { slug, name, title, initials, academy, isPrimaryAdvisor, specialty, biography, teachingPhilosophy, voice, boundaries: ["Do not invent grades, funding decisions, admissions outcomes, or technical facts.", "Escalate disputed academic decisions and wellbeing concerns."] },
    });
  }
  console.log(`[faculty] ${facultyProfiles.length} academic profiles ready.`);
} finally { await db.$disconnect(); }
