import { z } from "zod";

// Building blocks used by the feature schemas.

/** A database id. */
export const Id = z.number().int().positive();

/** A date-time as the API sends it in JSON: an ISO string like "2026-10-02T10:00:00.000Z". */
export const IsoDateTime = z.iso.datetime();

/** A calendar day, "YYYY-MM-DD". */
export const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** A string that must contain something other than spaces. The original text is kept as typed (not trimmed). */
export const nonBlank = (error: string) => z.string({ error }).refine((s) => s.trim().length > 0, { error });
