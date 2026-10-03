-- P6-06: typeahead under 50 ms. "Starts with" lookups use these (lower case; and with spaces and dashes taken out, so
-- "frontend" finds "Front End Engineer"). Like 9f, not in schema.prisma: leave out any DROP INDEX for them that
-- `prisma migrate diff` proposes.
CREATE INDEX "OccupationTitle_title_prefix" ON "OccupationTitle" (lower("title") text_pattern_ops);
CREATE INDEX "OccupationTitle_title_compact" ON "OccupationTitle" (regexp_replace(lower("title"), '[^a-z0-9]+', '', 'g') text_pattern_ops);
CREATE INDEX "TaxonomySkill_name_prefix" ON "TaxonomySkill" (lower("name") text_pattern_ops);
CREATE INDEX "TaxonomySkill_name_compact" ON "TaxonomySkill" (regexp_replace(lower("name"), '[^a-z0-9]+', '', 'g') text_pattern_ops);
CREATE INDEX "FieldOfStudy_title_prefix" ON "FieldOfStudy" (lower("title") text_pattern_ops);
CREATE INDEX "City_asciiName_prefix" ON "City" (lower("asciiName") text_pattern_ops);
