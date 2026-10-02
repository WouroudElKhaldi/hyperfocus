import { z } from "zod";
import { Id, IsoDateTime } from "./primitives.ts";

// The companion pet (P3-03: what the API sends back, documented so the website's generated types are exact).
// The rules themselves (species, unlocks, XP) live in the API (apps/api/src/pet.ts).

const counts = z.record(z.string(), z.number());

/** How a thing is unlocked: free, or by enough XP, tasks, study minutes, posts, streak days, goals, books or wins. */
export const UNLOCK_RULE_KINDS = ["free", "xp", "tasks", "studyMin", "posts", "streak", "goals", "books", "wins"] as const;
/** Anything that can be unlocked (clothes, backdrops, patterns, auras). `for` = which genders it fits. */
export const Unlockable = z.object({
  id: z.string(), name: z.string(), slot: z.string().optional(), for: z.string(), label: z.string(),
  unlocked: z.boolean(), have: z.number(), need: z.number(), kind: z.enum(UNLOCK_RULE_KINDS),
});
export const Personality = z.object({ id: z.string(), label: z.string(), title: z.string(), desc: z.string(), perk: counts });
export const AgeStep = z.object({ age: z.number(), name: z.string(), at: z.number() });
export const PetPoints = z.object({
  priority: counts,
  other: counts,
  capture: z.object({ thought: z.object({ xp: z.number(), cap: z.number(), label: z.string() }), task: z.object({ xp: z.number(), cap: z.number(), label: z.string() }) }),
});
/** What exists and what is unlocked, for choosing and dressing the pet. */
export const PetCatalog = z.object({
  ages: z.array(AgeStep), legendAt: z.number(), items: z.array(Unlockable), backdrops: z.array(Unlockable), patterns: z.array(Unlockable),
  auras: z.array(Unlockable), personalities: z.array(Personality), maxTraits: z.number(), points: PetPoints,
});
/** The stored pet. outfit is JSON text (slot -> item id); `outfit` on PetState is the parsed version. */
export const PetData = z.object({
  id: Id, name: z.string(), species: z.string(), gender: z.string(), color: z.string(), traits: z.array(z.string()), bio: z.string(),
  style: z.string(), outfit: z.string(), pattern: z.string(), aura: z.string(), backdrop: z.string(), createdAt: IsoDateTime,
});
export const PetStats = z.object({
  tasks: z.number(), steps: z.number(), goals: z.number(), posts: z.number(), wins: z.number(), reviews: z.number(),
  books: z.number(), studyMinutes: z.number(), streak: z.number(), bestStreak: z.number(),
});
export const PetBadge = z.object({ id: z.string(), label: z.string(), desc: z.string(), unlocked: z.boolean(), progress: z.number(), have: z.number(), need: z.number() });
export const Quest = z.object({ id: z.string(), label: z.string(), need: z.number(), bonus: z.number(), have: z.number(), done: z.boolean() });
/** The pet and everything about it: age, XP, mood, stats, today's quests, badges, what it can wear. */
export const PetState = PetCatalog.extend({
  pet: PetData,
  outfit: z.record(z.string(), z.string()),
  xp: z.number(), level: z.number(), legend: z.boolean(), nextAt: z.number().nullable(), from: z.number(), progress: z.number(),
  stage: z.number(), age: z.number(), stageName: z.string(), mood: z.string(), stats: PetStats, badges: z.array(PetBadge), perks: counts,
  today: z.object({ xp: z.number(), quests: z.array(Quest), allDone: z.boolean(), allBonus: z.number() }),
  ageDays: z.number(),
  recent: z.array(z.object({ source: z.string(), amount: z.number(), note: z.string(), createdAt: IsoDateTime })),
});
/** GET /api/pet: `pet` is null until she has chosen one. */
export const PetResponse = z.union([PetState, z.object({ pet: z.null() })]);
