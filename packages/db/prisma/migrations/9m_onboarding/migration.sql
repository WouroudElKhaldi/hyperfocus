-- P5-05: the welcome guide. Everyone already here has finished it; someone new sees it once.
ALTER TABLE "User" ADD COLUMN "onboardedAt" TIMESTAMP(3), ADD COLUMN "helpWith" TEXT[] DEFAULT ARRAY[]::TEXT[];
UPDATE "User" SET "onboardedAt" = CURRENT_TIMESTAMP;
