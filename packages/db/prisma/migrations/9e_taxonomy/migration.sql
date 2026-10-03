-- P6-03: the taxonomy (occupations, titles, skills, fields of study, industries, countries, cities) and the job enums.
-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('full_time', 'part_time', 'internship', 'apprenticeship', 'contract', 'freelance', 'volunteer', 'student_job');

-- CreateEnum
CREATE TYPE "Seniority" AS ENUM ('student', 'intern', 'entry', 'junior', 'mid', 'senior', 'lead');

-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('onsite', 'hybrid', 'remote');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('none', 'secondary', 'vocational', 'associate', 'bachelor', 'master', 'doctorate');

-- CreateEnum
CREATE TYPE "SkillType" AS ENUM ('skill', 'knowledge', 'tool', 'language', 'certification');

-- CreateTable
CREATE TABLE "OccupationGroup" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "parentId" INTEGER,
    "source" TEXT NOT NULL,
    "version" TEXT NOT NULL,

    CONSTRAINT "OccupationGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Occupation" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "jobZone" INTEGER,
    "groupId" INTEGER,
    "sameAsId" INTEGER,
    "source" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Occupation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccupationTitle" (
    "id" SERIAL NOT NULL,
    "occupationId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'en',
    "kind" TEXT NOT NULL DEFAULT 'alternative',

    CONSTRAINT "OccupationTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxonomySkill" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "type" "SkillType" NOT NULL,
    "name" TEXT NOT NULL,
    "altLabels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hot" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "version" TEXT NOT NULL,

    CONSTRAINT "TaxonomySkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccupationSkill" (
    "occupationId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,
    "importance" DOUBLE PRECISION NOT NULL,
    "essential" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OccupationSkill_pkey" PRIMARY KEY ("occupationId","skillId")
);

-- CreateTable
CREATE TABLE "FieldOfStudy" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "level" INTEGER NOT NULL,
    "parentId" INTEGER,
    "source" TEXT NOT NULL,
    "version" TEXT NOT NULL,

    CONSTRAINT "FieldOfStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldOfStudyOccupation" (
    "fieldId" INTEGER NOT NULL,
    "occupationId" INTEGER NOT NULL,

    CONSTRAINT "FieldOfStudyOccupation_pkey" PRIMARY KEY ("fieldId","occupationId")
);

-- CreateTable
CREATE TABLE "Industry" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "parentId" INTEGER,
    "source" TEXT NOT NULL,
    "version" TEXT NOT NULL,

    CONSTRAINT "Industry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "code" TEXT NOT NULL,
    "iso3" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "continent" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL DEFAULT '',
    "languages" TEXT NOT NULL DEFAULT '',
    "version" TEXT NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "City" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "asciiName" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "admin1" TEXT NOT NULL DEFAULT '',
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "population" INTEGER NOT NULL DEFAULT 0,
    "version" TEXT NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxonomyImport" (
    "id" SERIAL NOT NULL,
    "dataset" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "changes" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "TaxonomyImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OccupationGroup_code_key" ON "OccupationGroup"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Occupation_code_key" ON "Occupation"("code");

-- CreateIndex
CREATE INDEX "Occupation_groupId_idx" ON "Occupation"("groupId");

-- CreateIndex
CREATE INDEX "OccupationTitle_title_idx" ON "OccupationTitle"("title");

-- CreateIndex
CREATE UNIQUE INDEX "OccupationTitle_occupationId_lang_title_key" ON "OccupationTitle"("occupationId", "lang", "title");

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomySkill_code_key" ON "TaxonomySkill"("code");

-- CreateIndex
CREATE INDEX "TaxonomySkill_name_idx" ON "TaxonomySkill"("name");

-- CreateIndex
CREATE INDEX "OccupationSkill_skillId_idx" ON "OccupationSkill"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "FieldOfStudy_code_key" ON "FieldOfStudy"("code");

-- CreateIndex
CREATE INDEX "FieldOfStudy_parentId_idx" ON "FieldOfStudy"("parentId");

-- CreateIndex
CREATE INDEX "FieldOfStudyOccupation_occupationId_idx" ON "FieldOfStudyOccupation"("occupationId");

-- CreateIndex
CREATE UNIQUE INDEX "Industry_code_key" ON "Industry"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Country_iso3_key" ON "Country"("iso3");

-- CreateIndex
CREATE INDEX "City_countryCode_idx" ON "City"("countryCode");

-- CreateIndex
CREATE INDEX "City_asciiName_idx" ON "City"("asciiName");

-- AddForeignKey
ALTER TABLE "OccupationGroup" ADD CONSTRAINT "OccupationGroup_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OccupationGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occupation" ADD CONSTRAINT "Occupation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OccupationGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occupation" ADD CONSTRAINT "Occupation_sameAsId_fkey" FOREIGN KEY ("sameAsId") REFERENCES "Occupation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccupationTitle" ADD CONSTRAINT "OccupationTitle_occupationId_fkey" FOREIGN KEY ("occupationId") REFERENCES "Occupation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccupationSkill" ADD CONSTRAINT "OccupationSkill_occupationId_fkey" FOREIGN KEY ("occupationId") REFERENCES "Occupation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccupationSkill" ADD CONSTRAINT "OccupationSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "TaxonomySkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldOfStudy" ADD CONSTRAINT "FieldOfStudy_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FieldOfStudy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldOfStudyOccupation" ADD CONSTRAINT "FieldOfStudyOccupation_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "FieldOfStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldOfStudyOccupation" ADD CONSTRAINT "FieldOfStudyOccupation_occupationId_fkey" FOREIGN KEY ("occupationId") REFERENCES "Occupation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Industry" ADD CONSTRAINT "Industry_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE CASCADE ON UPDATE CASCADE;
