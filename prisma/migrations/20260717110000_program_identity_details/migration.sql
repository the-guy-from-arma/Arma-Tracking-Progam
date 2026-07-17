ALTER TABLE "AcademicProgram"
  ADD COLUMN "audience" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "culminatingExperience" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "learningOutcomes" JSONB NOT NULL DEFAULT '[]';
