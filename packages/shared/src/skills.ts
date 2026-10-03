import { z } from "zod";
import { Id, IsoDateTime, nonBlank } from "./primitives.ts";

// The skills gap map (P2-09): where she is (level) and where she wants to be (target), from 0 to 5. The rules are the
// ones the API used before: levels are rounded and kept between 0 and 5 (anything that isn't a number counts as 0).

export const Skill = z.object({
  id: Id,
  name: z.string(),
  area: z.string(),
  level: z.number().int(),
  target: z.number().int(),
  notes: z.string(),
  /** the standard skill it is linked to (P6-08): its code and name; both empty when it isn't */
  taxonomyCode: z.string(),
  taxonomyLabel: z.string(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type Skill = z.infer<typeof Skill>;
/** A standard skill's code ("onet-tech:Python"), or "" to unlink. The server checks it and fills in its name. */
const taxonomyCode = z.string().trim().max(200).optional();

/** A level from 0 to 5, rounded. Anything that isn't a number is 0. */
export const clampLevel = (n: unknown) => Math.min(5, Math.max(0, Math.round(Number(n) || 0)));
const level = z.preprocess((v) => (v === undefined ? undefined : clampLevel(v)), z.number().int().optional());

/** POST /api/skills. The target defaults to 4 (and 0 also becomes 4). */
export const CreateSkillInput = z.object({
  name: nonBlank("Give the skill a name.").transform((s) => s.trim()),
  area: z.string().optional(),
  notes: z.string().optional(),
  level,
  target: z.preprocess((v) => clampLevel(v ?? 4) || 4, z.number().int()),
  taxonomyCode,
});
export type CreateSkillInput = z.input<typeof CreateSkillInput>;

/** PATCH /api/skills/:id. Only the fields sent change; a target sent as 0 becomes 1. */
export const UpdateSkillInput = z.object({
  name: z.string().optional(),
  area: z.string().optional(),
  notes: z.string().optional(),
  level,
  target: z.preprocess((v) => (v === undefined ? undefined : clampLevel(v) || 1), z.number().int().optional()),
  taxonomyCode,
});
export type UpdateSkillInput = z.input<typeof UpdateSkillInput>;

/** POST /api/skills/bulk: the skills the AI suggested and she ticked. Nameless ones and names she already tracks are skipped. */
export const BulkSkillsInput = z.object({
  items: z.array(z.object({ name: z.string().optional(), area: z.string().optional(), why: z.string().optional() })).optional(),
});
export type BulkSkillsInput = z.input<typeof BulkSkillsInput>;

/** POST /api/skills/suggest */
export const SuggestSkillsInput = z.object({ context: nonBlank("Tell me a little about what feels shaky or what you work on.") });
export type SuggestSkillsInput = z.input<typeof SuggestSkillsInput>;
