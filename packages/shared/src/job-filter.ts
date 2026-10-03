import { z } from "zod";

// What a Job Radar filter asks for (P6-07, P6-20): one shape for the API, the website and the matching engine. Every
// part is optional; an empty filter matches everything. Taxonomy items keep their code (for matching) and their label
// (for showing).

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "internship", "apprenticeship", "contract", "freelance", "volunteer", "student_job"] as const;
export const SENIORITIES = ["student", "intern", "entry", "junior", "mid", "senior", "lead"] as const;
export const WORK_MODES = ["onsite", "hybrid", "remote"] as const;
export const EDUCATION_LEVELS = ["none", "secondary", "vocational", "associate", "bachelor", "master", "doctorate"] as const;
export const DIGESTS = ["off", "realtime", "daily", "weekly"] as const;
export const KEYWORD_SCOPES = ["title", "description", "requirements"] as const;

const Item = z.object({ code: z.string().min(1).max(100), label: z.string().min(1).max(200) });
const Words = z.array(z.string().trim().min(1).max(80)).max(50);

export const JobFilterSpec = z.object({
  /** jobs (taxonomy occupations) and free-text titles */
  occupations: z.array(Item).max(50).default([]),
  titles: Words.default([]),
  keywords: z.object({ include: Words.default([]), exclude: Words.default([]), scope: z.array(z.enum(KEYWORD_SCOPES)).default(["title", "description"]) }).default({ include: [], exclude: [], scope: ["title", "description"] }),
  /** must-have skills rule a job out when missing; nice-to-have ones only raise its score */
  skills: z.object({ must: z.array(Item).max(30).default([]), nice: z.array(Item).max(50).default([]) }).default({ must: [], nice: [] }),
  maxYearsExperience: z.number().int().min(0).max(40).nullable().default(null),
  educationLevel: z.enum(EDUCATION_LEVELS).nullable().default(null),
  languages: Words.default([]),
  fieldsOfStudy: z.array(Item).max(20).default([]),
  employmentTypes: z.array(z.enum(EMPLOYMENT_TYPES)).default([]),
  seniority: z.array(z.enum(SENIORITIES)).default([]),
  workModes: z.array(z.enum(WORK_MODES)).default([]),
  /** cities ("geonames:<id>") or countries ("LB"), with an optional radius around a city */
  locations: z.array(Item.extend({ radiusKm: z.number().int().min(0).max(500).nullable().default(null) })).max(20).default([]),
  salaryMin: z.object({ amount: z.number().int().min(0), currency: z.string().length(3) }).nullable().default(null),
  companies: z.object({ include: Words.default([]), exclude: Words.default([]) }).default({ include: [], exclude: [] }),
  industries: z.array(Item).max(20).default([]),
  postedWithinDays: z.number().int().min(1).max(90).nullable().default(null),
  visaSponsorship: z.boolean().nullable().default(null),
  /** how often matches are sent (P6-24) */
  digest: z.enum(DIGESTS).default("daily"),
});
export type JobFilterSpec = z.infer<typeof JobFilterSpec>;
export type JobFilterSpecInput = z.input<typeof JobFilterSpec>;

/** An empty filter: every field at its default. */
export const emptyJobFilter = (): JobFilterSpec => JobFilterSpec.parse({});
