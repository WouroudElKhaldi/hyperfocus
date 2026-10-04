-- The longer welcome guide (P5-14): studies, situation, how their brain works, what helps, how the AI should talk.
ALTER TABLE "Profile" ADD COLUMN "pronouns" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "studyLevel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "major" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "school" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "studyYear" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "situation" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "neuro" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Profile" ADD COLUMN "neuroNote" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "supports" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Profile" ADD COLUMN "tone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "bestTime" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "focusMins" INTEGER NOT NULL DEFAULT 0;
