-- P6-06: fast "type a few letters" search over the taxonomy, forgiving typos: trigram indexes (pg_trgm, built into
-- PostgreSQL). The extension lives in the public schema (one per database); everything names it as public.… so it
-- also works from the test runs' own schemas. (These indexes are not in schema.prisma: when generating a migration
-- with `prisma migrate diff`, leave out any DROP INDEX "..._trgm" it proposes.)
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE INDEX "OccupationTitle_title_trgm" ON "OccupationTitle" USING gin ("title" public.gin_trgm_ops);
CREATE INDEX "TaxonomySkill_name_trgm" ON "TaxonomySkill" USING gin ("name" public.gin_trgm_ops);
CREATE INDEX "FieldOfStudy_title_trgm" ON "FieldOfStudy" USING gin ("title" public.gin_trgm_ops);
CREATE INDEX "City_asciiName_trgm" ON "City" USING gin ("asciiName" public.gin_trgm_ops);
CREATE INDEX "Country_name_trgm" ON "Country" USING gin ("name" public.gin_trgm_ops);
CREATE INDEX "Industry_title_trgm" ON "Industry" USING gin ("title" public.gin_trgm_ops);
