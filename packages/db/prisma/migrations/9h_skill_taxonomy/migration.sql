-- P6-08: a skill on your Skills map can be linked to a standard skill of the taxonomy (optional; existing skills stay as they are).
ALTER TABLE "Skill" ADD COLUMN "taxonomyCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Skill" ADD COLUMN "taxonomyLabel" TEXT NOT NULL DEFAULT '';
