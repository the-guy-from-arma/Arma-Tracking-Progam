ALTER TABLE "InstitutionOperationalSetting"
  ADD COLUMN "campusBannerEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "campusBannerTitle" TEXT NOT NULL DEFAULT 'Welcome to Enscript University',
  ADD COLUMN "campusBannerMessage" TEXT NOT NULL DEFAULT 'The university is continuing to grow. New campus services and learning experiences are being added regularly.',
  ADD COLUMN "campusBannerPreset" TEXT,
  ADD COLUMN "campusBannerTone" TEXT NOT NULL DEFAULT 'INSTITUTIONAL',
  ADD COLUMN "hiddenNavigationViews" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "courseSelectionEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "programSelectionEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "experienceUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
