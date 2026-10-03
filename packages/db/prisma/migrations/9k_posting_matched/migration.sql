-- P6-23: when a posting was matched against everyone's filters (null = not yet).
ALTER TABLE "JobPosting" ADD COLUMN "matchedAt" TIMESTAMP(3);
CREATE INDEX "JobPosting_matchedAt_idx" ON "JobPosting"("matchedAt");
