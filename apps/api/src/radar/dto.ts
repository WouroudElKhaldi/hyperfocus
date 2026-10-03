import { z } from "zod";

// The one shape every source's posting is turned into (P6-12, the anti-corruption layer): whatever a source calls its
// fields, the rest of Job Radar only ever sees this. Checked with Zod, so a source that changes its format is caught
// at the door with a clear message instead of storing nonsense.

export const JobPostingDTO = z.object({
  externalId: z.string().min(1).max(200),
  url: z.string().url().max(2000),
  title: z.string().trim().min(1).max(300),
  company: z.string().trim().max(200).default(""),
  /** plain text (adapters convert HTML) */
  description: z.string().max(100_000).default(""),
  locationText: z.string().trim().max(500).default(""),
  /** ISO 3166-1 alpha-2, when the source says it */
  countryCode: z.string().length(2).toUpperCase().nullable().default(null),
  /** what the source itself says, if anything (the classifier also reads the text) */
  remote: z.boolean().nullable().default(null),
  workModeHint: z.string().max(50).default(""),
  employmentHint: z.string().max(200).default(""),
  tags: z.array(z.string().max(100)).max(50).default([]),
  postedAt: z.date(),
  /** when the source says the posting closes */
  closesAt: z.date().nullable().default(null),
  salary: z.object({ min: z.number().nullable(), max: z.number().nullable(), currency: z.string().max(3), period: z.enum(["year", "month", "hour", ""]) }).nullable().default(null),
});
export type JobPostingDTO = z.infer<typeof JobPostingDTO>;
export type JobPostingInput = z.input<typeof JobPostingDTO>;
