-- P6-10, P6-20: Job Radar: sources, postings, their skills, ingest batches (shared), and each person's filters and matches.
-- CreateTable
CREATE TABLE "JobSource" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastOkAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "lastItems" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPosting" (
    "id" SERIAL NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "locationText" TEXT NOT NULL DEFAULT '',
    "countryCode" TEXT NOT NULL DEFAULT '',
    "cityId" INTEGER,
    "workMode" "WorkMode",
    "employmentType" "EmploymentType",
    "seniority" "Seniority",
    "educationLevel" "EducationLevel",
    "yearsMin" INTEGER,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT NOT NULL DEFAULT '',
    "salaryPeriod" TEXT NOT NULL DEFAULT '',
    "visaSponsorship" BOOLEAN,
    "occupationId" INTEGER,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "duplicateOfId" INTEGER,
    "contentHash" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "raw" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPostingSkill" (
    "postingId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,
    "via" TEXT NOT NULL DEFAULT 'dictionary',

    CONSTRAINT "JobPostingSkill_pkey" PRIMARY KEY ("postingId","skillId")
);

-- CreateTable
CREATE TABLE "IngestBatch" (
    "id" SERIAL NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "cursor" TEXT NOT NULL DEFAULT '',
    "received" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "IngestBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobFilter" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL DEFAULT current_setting('hyperfocus.user_id'),
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "spec" JSONB NOT NULL DEFAULT '{}',
    "weights" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobFilter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobMatch" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL DEFAULT current_setting('hyperfocus.user_id'),
    "filterId" INTEGER NOT NULL,
    "postingId" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reasons" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'new',
    "feedback" INTEGER NOT NULL DEFAULT 0,
    "applicationId" INTEGER,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobSource_key_key" ON "JobSource"("key");

-- CreateIndex
CREATE INDEX "JobPosting_contentHash_idx" ON "JobPosting"("contentHash");

-- CreateIndex
CREATE INDEX "JobPosting_postedAt_idx" ON "JobPosting"("postedAt");

-- CreateIndex
CREATE INDEX "JobPosting_expiresAt_idx" ON "JobPosting"("expiresAt");

-- CreateIndex
CREATE INDEX "JobPosting_occupationId_idx" ON "JobPosting"("occupationId");

-- CreateIndex
CREATE UNIQUE INDEX "JobPosting_sourceId_externalId_key" ON "JobPosting"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "JobPostingSkill_skillId_idx" ON "JobPostingSkill"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "IngestBatch_idempotencyKey_key" ON "IngestBatch"("idempotencyKey");

-- CreateIndex
CREATE INDEX "JobFilter_userId_idx" ON "JobFilter"("userId");

-- CreateIndex
CREATE INDEX "JobMatch_userId_status_idx" ON "JobMatch"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "JobMatch_filterId_postingId_key" ON "JobMatch"("filterId", "postingId");

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "JobSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPostingSkill" ADD CONSTRAINT "JobPostingSkill_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestBatch" ADD CONSTRAINT "IngestBatch_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "JobSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobFilter" ADD CONSTRAINT "JobFilter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_filterId_fkey" FOREIGN KEY ("filterId") REFERENCES "JobFilter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
