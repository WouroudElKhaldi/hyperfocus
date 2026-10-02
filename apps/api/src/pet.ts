import type { Pet } from "@hyperfocus/db";
import { TASK_PRIORITIES, TASK_PRIORITY_POINTS } from "@hyperfocus/shared/constants";
import { activeMs, type Db, errorInfo, type UncheckedJson } from "./types.ts";

// The companion pet. All growth comes from things she really completed or added (see award()), never from clicking for points.
export const SPECIES = ["cat", "fox", "bunny", "dragon", "blob"];
// The pet can be a boy, a girl, or either. It changes how it looks and which clothes it can wear (items marked for one gender).
export const GENDERS = ["boy", "girl", "neutral"];

// ---------- ages ----------
// The pet has an age that depends on the XP she has earned. Each age looks different (see PetArt on the website).
type Age = { age: number; name: string; at: number };
export const AGES: Age[] = [
  { age: 0, name: "Egg", at: 0 },
  { age: 1, name: "Newborn", at: 30 },
  { age: 2, name: "Baby", at: 120 },
  { age: 3, name: "Toddler", at: 300 },
  { age: 4, name: "Little kid", at: 600 },
  { age: 5, name: "Kid", at: 1100 },
  { age: 6, name: "Tween", at: 1800 },
  { age: 7, name: "Teen", at: 2800 },
  { age: 8, name: "Young adult", at: 4200 },
  { age: 9, name: "Grown-up", at: 6000 },
];
// Growing up is meant to take months of steady work, not a few busy days.
export const LEGEND_XP = 9000;

// ---------- points ----------
// More important things earn more. Tasks depend on the importance she picks.
// The list and the points live in @hyperfocus/shared, so the website shows exactly what is awarded here.
export const PRIORITIES = TASK_PRIORITIES;
export const PRIORITY_POINTS = TASK_PRIORITY_POINTS;
const POINTS_BY_NAME: Record<string, number | undefined> = PRIORITY_POINTS;
// After this many finished tasks in one day, each further task is worth 1 point, so a pile of tiny tasks can't be farmed.
export const TASK_DAILY_FULL = 8;
export const taskXp = (priority: string): number => POINTS_BY_NAME[priority] ?? 10;
export const XP = { step: 2, goal: 50, post: 25, win: 4, review: 10, skill: 4, book: 15 };
// Study: 2 points per 20 active minutes up to 16 per session, plus 6 for a deep-focus session of 45 minutes or more.
export const studyXp = (activeMinutes: number): number => (activeMinutes >= 5 ? Math.min(16, Math.max(1, Math.floor(activeMinutes / 10)) * 2) + (activeMinutes >= 45 ? 6 : 0) : 0);
// Small points just for adding things (capped per day so adding lots of tiny items can't farm points).
type CaptureRule = { xp: number; cap: number; label: string };
export const CAPTURE: Record<string, CaptureRule> = { thought: { xp: 1, cap: 3, label: "Captured a thought" }, task: { xp: 1, cap: 3, label: "Planned a task" } };
// Daily quests: a bonus for each one, and more for doing all three.
type QuestId = "tasks" | "study" | "heart";
export const QUESTS: { id: QuestId; label: string; need: number; bonus: number }[] = [
  { id: "tasks", label: "Finish 3 tasks", need: 3, bonus: 6 },
  { id: "study", label: "Study for 30 minutes", need: 30, bonus: 6 },
  { id: "heart", label: "Move a goal, share a post or log a win", need: 1, bonus: 6 },
];
export const ALL_QUESTS_BONUS = 10;

// ---------- personalities ----------
// Each one changes how the pet talks (the words live in the website) and gives a small XP bonus for one kind of progress.
// A pet can have up to 5. Bonuses from all of them add up, capped at +30% per kind of progress.
export const MAX_TRAITS = 5;
const PERK_CAP = 30;
type Personality = { label: string; title: string; desc: string; perk: Record<string, number> };
export const PERSONALITIES: Record<string, Personality> = {
  curious:  { label: "Curious",   title: "The Explorer",    desc: "Always asking what if, and loves learning new things.", perk: { study: 10 } },
  nerdy:    { label: "Nerdy",     title: "The Scholar",     desc: "Drops fun facts and gets very excited about concepts.", perk: { study: 15 } },
  nightowl: { label: "Night owl", title: "The Night Owl",   desc: "Comes alive late. Gentle reminders to sleep too.",      perk: { study: 10 } },
  playful:  { label: "Playful",   title: "The Puppy",       desc: "Bouncy and excited about every little thing you finish.", perk: { task: 10 } },
  hyper:    { label: "Hype",      title: "The Cheerleader", desc: "Loud, proud and always on your side.",                   perk: { task: 15 } },
  focused:  { label: "Focused",   title: "The Planner",     desc: "Loves a tiny next step and a tidy plan.",                perk: { step: 15 } },
  gentle:   { label: "Gentle",    title: "The Caretaker",   desc: "Soft words, patient, never pushes.",                     perk: { step: 10 } },
  calm:     { label: "Calm",      title: "The Zen Friend",  desc: "Slow, steady and full of breathing reminders.",          perk: { review: 15 } },
  cheeky:   { label: "Cheeky",    title: "The Joker",       desc: "Playful teasing, and loves it when you brag.",           perk: { win: 15 } },
  brave:    { label: "Brave",     title: "The Champion",    desc: "Bold and encouraging, pushes you to share your work.",   perk: { post: 15 } },
  rebel:    { label: "Rebel",     title: "The Rebel",       desc: "Cheers you on to break the rules of perfectionism.",     perk: { post: 10 } },
  sleepy:   { label: "Sleepy",    title: "The Napper",      desc: "Yawns a lot, thinks rest and reading are heroic.",       perk: { book: 15 } },
  wise:     { label: "Wise",      title: "The Mentor",      desc: "Calm advice, always sees how far you've come.",          perk: { skill: 20 } },
  dreamer:  { label: "Dreamer",   title: "The Dreamer",     desc: "Sees the big picture and cheers for your goals.",        perk: { goal: 20 } },
};
export const TRAITS = Object.keys(PERSONALITIES);
function bonusPct(traitsCsv: string, source: string): number {
  const sum = (traitsCsv || "").split(",").filter(Boolean).reduce((t, id) => t + (PERSONALITIES[id]?.perk?.[source] || 0), 0);
  return Math.min(PERK_CAP, sum);
}
function perkSummary(traits: string[]) {
  const out: Record<string, number> = {};
  for (const src of ["task", "step", "goal", "post", "study", "win", "review", "skill", "book"]) { const p = bonusPct(traits.join(","), src); if (p) out[src] = p; }
  return out;
}

// ---------- unlockables: clothes, backdrops, patterns, auras ----------
// rule.kind: free | xp | tasks | studyMin | posts | streak | goals | books | wins
export const SLOTS = ["head", "face", "neck", "body", "extra", "look"] as const;
type Slot = (typeof SLOTS)[number];
type Outfit = Partial<Record<Slot, string>>;

/** How something is unlocked: free, or by reaching `n` of something. */
type Rule = { kind: "free" } | { kind: "xp" | "tasks" | "studyMin" | "posts" | "streak" | "goals" | "books" | "wins"; n: number };
/** Something that can be unlocked. `for` limits it to one gender. */
type Unlockable = { id: string; name: string; rule: Rule; for?: "boy" | "girl" };
type Item = Unlockable & { slot: Slot };
/** What has been earned, which is what unlocking is checked against. */
type UnlockState = { xp: number; stats: { tasks: number; studyMinutes: number; posts: number; bestStreak: number; goals: number; books: number; wins: number } };

export const ITEMS: Item[] = [
  // ----- head -----
  { id: "bow", slot: "head", name: "Bow", for: "girl", rule: { kind: "free" } },
  { id: "flower", slot: "head", name: "Flower", for: "girl", rule: { kind: "free" } },
  { id: "snapback", slot: "head", name: "Snapback cap", for: "boy", rule: { kind: "free" } },
  { id: "beanie", slot: "head", name: "Cozy beanie", rule: { kind: "xp", n: 120 } },
  { id: "cap", slot: "head", name: "Baseball cap", rule: { kind: "tasks", n: 15 } },
  { id: "flatcap", slot: "head", name: "Flat cap", for: "boy", rule: { kind: "tasks", n: 20 } },
  { id: "party", slot: "head", name: "Party hat", rule: { kind: "streak", n: 3 } },
  { id: "headphones", slot: "head", name: "Headphones", rule: { kind: "studyMin", n: 300 } },
  { id: "hardhat", slot: "head", name: "Hard hat", rule: { kind: "studyMin", n: 480 } },
  { id: "fedora", slot: "head", name: "Fedora", for: "boy", rule: { kind: "posts", n: 4 } },
  { id: "tophat", slot: "head", name: "Top hat", rule: { kind: "posts", n: 5 } },
  { id: "sunhat", slot: "head", name: "Sun hat", for: "girl", rule: { kind: "xp", n: 800 } },
  { id: "wizard", slot: "head", name: "Wizard hat", rule: { kind: "studyMin", n: 900 } },
  { id: "chef", slot: "head", name: "Chef hat", rule: { kind: "wins", n: 25 } },
  { id: "cowboy", slot: "head", name: "Cowboy hat", for: "boy", rule: { kind: "xp", n: 1400 } },
  { id: "headset", slot: "head", name: "Gaming headset", rule: { kind: "studyMin", n: 1500 } },
  { id: "halo", slot: "head", name: "Angel halo", rule: { kind: "xp", n: 2000 } },
  { id: "tiara", slot: "head", name: "Tiara", for: "girl", rule: { kind: "xp", n: 2800 } },
  { id: "viking", slot: "head", name: "Viking helmet", for: "boy", rule: { kind: "xp", n: 3200 } },
  { id: "crown", slot: "head", name: "Crown", rule: { kind: "xp", n: 5200 } },
  // ----- face -----
  { id: "glasses", slot: "face", name: "Round glasses", rule: { kind: "xp", n: 200 } },
  { id: "squareglasses", slot: "face", name: "Square glasses", for: "boy", rule: { kind: "xp", n: 400 } },
  { id: "sunglasses", slot: "face", name: "Sunglasses", rule: { kind: "tasks", n: 25 } },
  { id: "catglasses", slot: "face", name: "Cat-eye glasses", for: "girl", rule: { kind: "wins", n: 8 } },
  { id: "starshades", slot: "face", name: "Star shades", for: "girl", rule: { kind: "streak", n: 7 } },
  { id: "eyepatch", slot: "face", name: "Eye patch", for: "boy", rule: { kind: "wins", n: 12 } },
  { id: "vr", slot: "face", name: "VR headset", rule: { kind: "books", n: 2 } },
  { id: "heartshades", slot: "face", name: "Heart shades", for: "girl", rule: { kind: "wins", n: 20 } },
  { id: "monocle", slot: "face", name: "Monocle", rule: { kind: "books", n: 3 } },
  { id: "aviators", slot: "face", name: "Aviators", for: "boy", rule: { kind: "tasks", n: 60 } },
  // ----- neck and jewelry -----
  { id: "bandana", slot: "neck", name: "Bandana", rule: { kind: "tasks", n: 10 } },
  { id: "scarf", slot: "neck", name: "Scarf", rule: { kind: "xp", n: 600 } },
  { id: "bowtie", slot: "neck", name: "Bow tie", rule: { kind: "posts", n: 1 } },
  { id: "necktie", slot: "neck", name: "Necktie", rule: { kind: "posts", n: 2 } },
  { id: "dogtags", slot: "neck", name: "Dog tags", for: "boy", rule: { kind: "streak", n: 5 } },
  { id: "lanyard", slot: "neck", name: "Work badge", rule: { kind: "studyMin", n: 360 } },
  { id: "pearls", slot: "neck", name: "Pearl necklace", for: "girl", rule: { kind: "studyMin", n: 600 } },
  { id: "choker", slot: "neck", name: "Choker", for: "girl", rule: { kind: "xp", n: 900 } },
  { id: "lei", slot: "neck", name: "Flower lei", for: "girl", rule: { kind: "xp", n: 700 } },
  { id: "chain", slot: "neck", name: "Gold chain", rule: { kind: "tasks", n: 50 } },
  { id: "silverchain", slot: "neck", name: "Silver chain", for: "boy", rule: { kind: "tasks", n: 80 } },
  { id: "pendant", slot: "neck", name: "Heart pendant", for: "girl", rule: { kind: "wins", n: 10 } },
  { id: "medal", slot: "neck", name: "Gold medal", rule: { kind: "goals", n: 2 } },
  { id: "diamond", slot: "neck", name: "Diamond necklace", for: "girl", rule: { kind: "xp", n: 4000 } },
  // ----- clothes -----
  { id: "tee", slot: "body", name: "T-shirt", rule: { kind: "free" } },
  { id: "polo", slot: "body", name: "Polo shirt", for: "boy", rule: { kind: "xp", n: 350 } },
  { id: "hoodie", slot: "body", name: "Hoodie", rule: { kind: "xp", n: 300 } },
  { id: "cardigan", slot: "body", name: "Cardigan", for: "girl", rule: { kind: "xp", n: 450 } },
  { id: "sweater", slot: "body", name: "Cozy sweater", rule: { kind: "xp", n: 500 } },
  { id: "flannel", slot: "body", name: "Flannel shirt", for: "boy", rule: { kind: "xp", n: 700 } },
  { id: "raincoat", slot: "body", name: "Raincoat", rule: { kind: "studyMin", n: 120 } },
  { id: "cape", slot: "body", name: "Hero cape", rule: { kind: "goals", n: 1 } },
  { id: "overalls", slot: "body", name: "Overalls", rule: { kind: "tasks", n: 40 } },
  { id: "jersey", slot: "body", name: "Sports jersey", for: "boy", rule: { kind: "tasks", n: 55 } },
  { id: "hawaiian", slot: "body", name: "Hawaiian shirt", for: "boy", rule: { kind: "wins", n: 18 } },
  { id: "blazer", slot: "body", name: "Blazer", rule: { kind: "posts", n: 3 } },
  { id: "dress", slot: "body", name: "Party dress", for: "girl", rule: { kind: "xp", n: 1000 } },
  { id: "sundress", slot: "body", name: "Sundress", for: "girl", rule: { kind: "xp", n: 1500 } },
  { id: "labcoat", slot: "body", name: "Lab coat", rule: { kind: "studyMin", n: 1800 } },
  { id: "tuxedo", slot: "body", name: "Tuxedo", rule: { kind: "posts", n: 6 } },
  { id: "suit", slot: "body", name: "Business suit", for: "boy", rule: { kind: "posts", n: 8 } },
  { id: "tutu", slot: "body", name: "Ballet tutu", for: "girl", rule: { kind: "streak", n: 10 } },
  { id: "leather", slot: "body", name: "Leather jacket", for: "boy", rule: { kind: "xp", n: 2200 } },
  { id: "sailor", slot: "body", name: "Sailor suit", rule: { kind: "studyMin", n: 2400 } },
  { id: "armor", slot: "body", name: "Knight armor", for: "boy", rule: { kind: "xp", n: 4800 } },
  // ----- things to hold or wear -----
  { id: "coffee", slot: "extra", name: "Coffee cup", rule: { kind: "studyMin", n: 60 } },
  { id: "watch", slot: "extra", name: "Smart watch", rule: { kind: "tasks", n: 12 } },
  { id: "balloon", slot: "extra", name: "Balloon", rule: { kind: "wins", n: 3 } },
  { id: "earrings", slot: "extra", name: "Gold earrings", for: "girl", rule: { kind: "studyMin", n: 180 } },
  { id: "studs", slot: "extra", name: "Ear studs", for: "boy", rule: { kind: "studyMin", n: 240 } },
  { id: "book", slot: "extra", name: "Book", rule: { kind: "studyMin", n: 240 } },
  { id: "briefcase", slot: "extra", name: "Briefcase", for: "boy", rule: { kind: "posts", n: 2 } },
  { id: "bracelet", slot: "extra", name: "Bracelet", for: "girl", rule: { kind: "wins", n: 5 } },
  { id: "controller", slot: "extra", name: "Game controller", rule: { kind: "wins", n: 6 } },
  { id: "backpack", slot: "extra", name: "Backpack", rule: { kind: "books", n: 1 } },
  { id: "handbag", slot: "extra", name: "Handbag", for: "girl", rule: { kind: "books", n: 1 } },
  { id: "umbrella", slot: "extra", name: "Umbrella", rule: { kind: "goals", n: 3 } },
  { id: "guitar", slot: "extra", name: "Guitar", rule: { kind: "goals", n: 2 } },
  { id: "skateboard", slot: "extra", name: "Skateboard", for: "boy", rule: { kind: "streak", n: 4 } },
  { id: "shield", slot: "extra", name: "Shield", for: "boy", rule: { kind: "goals", n: 4 } },
  { id: "sword", slot: "extra", name: "Sword", for: "boy", rule: { kind: "xp", n: 2600 } },
  { id: "wand", slot: "extra", name: "Star wand", for: "girl", rule: { kind: "xp", n: 2400 } },
  { id: "fairywings", slot: "extra", name: "Fairy wings", for: "girl", rule: { kind: "xp", n: 3600 } },
  { id: "laptop", slot: "extra", name: "Laptop", rule: { kind: "studyMin", n: 3000 } },
  // ----- looks: facial hair, makeup and little details -----
  { id: "bandaid", slot: "look", name: "Band-aid", rule: { kind: "free" } },
  { id: "lashes", slot: "look", name: "Long lashes", for: "girl", rule: { kind: "free" } },
  { id: "stubble", slot: "look", name: "Stubble", for: "boy", rule: { kind: "free" } },
  { id: "mustache", slot: "look", name: "Mustache", for: "boy", rule: { kind: "tasks", n: 8 } },
  { id: "glitter", slot: "look", name: "Face glitter", for: "girl", rule: { kind: "wins", n: 4 } },
  { id: "sideburns", slot: "look", name: "Sideburns", for: "boy", rule: { kind: "tasks", n: 22 } },
  { id: "warpaint", slot: "look", name: "War paint", rule: { kind: "streak", n: 3 } },
  { id: "goatee", slot: "look", name: "Goatee", for: "boy", rule: { kind: "xp", n: 1000 } },
  { id: "beard", slot: "look", name: "Full beard", for: "boy", rule: { kind: "xp", n: 2000 } },
];
export const BACKDROP_LIST: Unlockable[] = [
  { id: "meadow", name: "Meadow", rule: { kind: "free" } },
  { id: "night", name: "Night sky", rule: { kind: "xp", n: 200 } },
  { id: "sunrise", name: "Sunrise", rule: { kind: "xp", n: 500 } },
  { id: "candy", name: "Candy clouds", rule: { kind: "xp", n: 900 } },
  { id: "beach", name: "Beach", rule: { kind: "studyMin", n: 1200 } },
  { id: "space", name: "Space", rule: { kind: "xp", n: 3000 } },
];
export const PATTERN_LIST: Unlockable[] = [
  { id: "none", name: "Plain", rule: { kind: "free" } },
  { id: "freckles", name: "Freckles", rule: { kind: "xp", n: 80 } },
  { id: "spots", name: "Spots", rule: { kind: "xp", n: 400 } },
  { id: "stripes", name: "Stripes", rule: { kind: "tasks", n: 30 } },
  { id: "hearts", name: "Hearts", rule: { kind: "wins", n: 15 } },
  { id: "stars", name: "Stars", rule: { kind: "studyMin", n: 1500 } },
];
export const AURA_LIST: Unlockable[] = [
  { id: "none", name: "None", rule: { kind: "free" } },
  { id: "glow", name: "Soft glow", rule: { kind: "xp", n: 1400 } },
  { id: "sparkles", name: "Sparkles", rule: { kind: "streak", n: 7 } },
  { id: "rainbow", name: "Rainbow", rule: { kind: "xp", n: 6000 } },
];
const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
const findIn = (list: Unlockable[], id: unknown) => list.find((x) => x.id === id);

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
function ruleLabel(r: Rule): string {
  switch (r.kind) {
    case "free": return "Free";
    case "xp": return `Reach ${r.n} points`;
    case "tasks": return `Finish ${plural(r.n, "task")}`;
    case "studyMin": return `Study ${r.n >= 60 ? plural(r.n / 60, "hour") : r.n + " minutes"}`;
    case "posts": return `Publish ${plural(r.n, "post")}`;
    case "streak": return `${r.n} days of progress in a row`;
    case "goals": return `Reach ${plural(r.n, "goal")}`;
    case "books": return `Finish ${plural(r.n, "book")}`;
    case "wins": return `Log ${plural(r.n, "win")}`;
    default: return "";
  }
}
function haveFor(r: Rule, st: UnlockState): number {
  switch (r.kind) {
    case "xp": return st.xp;
    case "tasks": return st.stats.tasks;
    case "studyMin": return st.stats.studyMinutes;
    case "posts": return st.stats.posts;
    case "streak": return st.stats.bestStreak;
    case "goals": return st.stats.goals;
    case "books": return st.stats.books;
    case "wins": return st.stats.wins;
    default: return 0;
  }
}
const unlockedRule = (rule: Rule, st: UnlockState) => rule.kind === "free" || haveFor(rule, st) >= rule.n;
const describe = (e: Unlockable, st: UnlockState) => ({ ...e, for: e.for || "all", rule: undefined, label: ruleLabel(e.rule), unlocked: unlockedRule(e.rule, st), have: e.rule.kind === "free" ? 0 : Math.min(haveFor(e.rule, st), e.rule.n), need: e.rule.kind === "free" ? 0 : e.rule.n, kind: e.rule.kind });
const fits = (item: Item, gender: string) => !item.for || gender === "neutral" || item.for === gender;
/** What cleanPet checks a change against: what was earned, plus what the pet already has on. */
type CleanState = UnlockState & { outfit?: Outfit; pet?: Partial<Pick<Pet, "gender" | "backdrop" | "pattern" | "aura">> | null };
const ZERO_STATE: CleanState = { xp: 0, stats: { tasks: 0, studyMinutes: 0, posts: 0, bestStreak: 0, goals: 0, books: 0, wins: 0 }, outfit: {}, pet: {} };

const LEGACY_STYLE: Record<string, [Slot, string] | undefined> = { bow: ["head", "bow"], flower: ["head", "flower"], crown: ["head", "crown"], headphones: ["head", "headphones"], glasses: ["face", "glasses"], scarf: ["neck", "scarf"] };
function parseOutfit(pet: Pet): Outfit {
  let o: UncheckedJson = {};
  try { o = JSON.parse(pet.outfit || "{}"); } catch { o = {}; }
  const clean: Outfit = {};
  for (const slot of SLOTS) if (o[slot] && ITEM[o[slot]]?.slot === slot) clean[slot] = o[slot];
  const legacy = LEGACY_STYLE[pet.style];
  if (!Object.keys(clean).length && legacy) clean[legacy[0]] = legacy[1]; // pets made before the wardrobe
  return clean;
}

// ---------- time helpers ----------
const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayBefore = (s: string) => { const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() - 1); return localDay(d); };
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

// ---------- earning XP ----------
// Never throws: a problem here must not break the thing she was actually doing.
async function createRow(prisma: Db, pet: Pet, key: string, source: string, amount: number, note: string, bonusSource = source) {
  const final = Math.round(amount * (1 + bonusPct(pet.traits, bonusSource) / 100));
  return prisma.petXp.create({ data: { key, source, amount: final, note: String(note).slice(0, 140) } });
}

export async function award(prisma: Db, key: string, source: string, amount: number, note = "") {
  try {
    const pet = await prisma.pet.findFirst();
    if (!pet || amount <= 0) return null;
    if (await prisma.petXp.findUnique({ where: { key } })) return null;
    if (source === "task" && (await prisma.petXp.count({ where: { source: "task", createdAt: { gte: startOfToday() } } })) >= TASK_DAILY_FULL) amount = 1;
    const row = await createRow(prisma, pet, key, source, amount, note);
    await checkQuests(prisma);
    return row;
  } catch (e) { console.error("XP award failed:", errorInfo(e).message); return null; }
}

// For things that can grow after the first award (a study session she continues): only ever raise the amount.
export async function awardAtLeast(prisma: Db, key: string, source: string, amount: number, note = "") {
  try {
    const pet = await prisma.pet.findFirst();
    if (!pet || amount <= 0) return null;
    const final = Math.round(amount * (1 + bonusPct(pet.traits, source) / 100));
    const existing = await prisma.petXp.findUnique({ where: { key } });
    let row = null;
    if (!existing) row = await prisma.petXp.create({ data: { key, source, amount: final, note: String(note).slice(0, 140) } });
    else if (final > existing.amount) row = await prisma.petXp.update({ where: { key }, data: { amount: final, note: String(note).slice(0, 140) } });
    await checkQuests(prisma);
    return row;
  } catch (e) { console.error("XP award failed:", errorInfo(e).message); return null; }
}

// Small points for adding something, at most `cap` per day per kind.
export async function awardCapture(prisma: Db, kind: string, refId: number) {
  try {
    const cfg = CAPTURE[kind];
    const pet = await prisma.pet.findFirst();
    if (!cfg || !pet) return null;
    const today = await prisma.petXp.count({ where: { source: "add", key: { startsWith: `cap:${kind}:` }, createdAt: { gte: startOfToday() } } });
    if (today >= cfg.cap) return null;
    const key = `cap:${kind}:${refId}`;
    if (await prisma.petXp.findUnique({ where: { key } })) return null;
    return await prisma.petXp.create({ data: { key, source: "add", amount: cfg.xp, note: cfg.label } });
  } catch (e) { console.error("XP award failed:", errorInfo(e).message); return null; }
}

// Progress on today's quests, from what she really did today.
async function questProgress(prisma: Db): Promise<{ rows: { source: string }[]; have: Record<QuestId, number> }> {
  const since = startOfToday();
  const rows = await prisma.petXp.findMany({ where: { createdAt: { gte: since } } });
  const sessions = await prisma.studySession.findMany({ where: { endedAt: { gte: since } } });
  const studyMin = Math.round(sessions.reduce((t, s) => t + activeMs(s) / 60000, 0));
  return {
    rows,
    have: {
      tasks: rows.filter((r) => r.source === "task").length,
      study: studyMin,
      heart: rows.filter((r) => ["step", "post", "win", "goal"].includes(r.source)).length,
    },
  };
}

// Gives each finished quest its bonus once per day, and the extra bonus when all three are done.
async function checkQuests(prisma: Db): Promise<void> {
  try {
    const day = localDay(new Date());
    const { have } = await questProgress(prisma);
    let all = true;
    for (const q of QUESTS) {
      if (have[q.id] >= q.need) {
        const key = `quest:${day}:${q.id}`;
        if (!(await prisma.petXp.findUnique({ where: { key } }))) await prisma.petXp.create({ data: { key, source: "quest", amount: q.bonus, note: `Daily quest: ${q.label}` } });
      } else all = false;
    }
    if (all) {
      const key = `quest:${day}:all`;
      if (!(await prisma.petXp.findUnique({ where: { key } }))) await prisma.petXp.create({ data: { key, source: "quest", amount: ALL_QUESTS_BONUS, note: "All daily quests done" } });
    }
  } catch (e) { console.error("Quest check failed:", errorInfo(e).message); }
}

// What exists and what is unlocked when nothing has been earned yet: used by the screen where you choose your pet.
export function catalogState() {
  const st = ZERO_STATE;
  return {
    ages: AGES, legendAt: LEGEND_XP,
    items: ITEMS.map((i) => describe(i, st)),
    backdrops: BACKDROP_LIST.map((b) => describe(b, st)),
    patterns: PATTERN_LIST.map((p) => describe(p, st)),
    auras: AURA_LIST.map((a) => describe(a, st)),
    personalities: Object.entries(PERSONALITIES).map(([id, p]) => ({ id, ...p })),
    maxTraits: MAX_TRAITS,
    points: { priority: PRIORITY_POINTS, other: { step: XP.step, goal: XP.goal, post: XP.post, win: XP.win, review: XP.review, skill: XP.skill, book: XP.book }, capture: CAPTURE },
  };
}

export function levelFor(xp: number) {
  let level = 0;
  AGES.forEach((a) => { if (xp >= a.at) level = a.age; });
  const legend = xp >= LEGEND_XP;
  const nextAt = level < AGES.length - 1 ? (AGES[level + 1]?.at ?? null) : legend ? null : LEGEND_XP;
  const from = legend ? LEGEND_XP : (AGES[level]?.at ?? 0);
  const progress = nextAt === null ? 1 : (xp - from) / (nextAt - from);
  return { level, legend, nextAt, from, progress: Math.max(0, Math.min(1, progress)) };
}

export async function petState(prisma: Db) {
  const pet = await prisma.pet.findFirst();
  if (!pet) return { pet: null };

  const rows = await prisma.petXp.findMany({ orderBy: { createdAt: "desc" } });
  const xp = rows.reduce((t, r) => t + r.amount, 0);
  const lv = levelFor(xp);

  // streaks: consecutive days with any progress. Today still counts while it's in progress.
  const days = new Set(rows.map((r) => localDay(r.createdAt)));
  const today = localDay(new Date());
  let streak = 0;
  for (let d = days.has(today) ? today : dayBefore(today); days.has(d); d = dayBefore(d)) streak++;
  let bestStreak = 0, run = 0, prev: string | null = null;
  for (const d of [...days].sort()) { run = prev && dayBefore(d) === prev ? run + 1 : 1; bestStreak = Math.max(bestStreak, run); prev = d; }
  const activeToday = days.has(today);
  const activeYesterday = days.has(dayBefore(today));
  // the pet never gets sad or sick, it just rests when things are quiet
  const mood = lv.level === 0 ? "egg" : activeToday ? "happy" : activeYesterday ? "content" : "sleepy";

  const count = (source: string) => rows.filter((r) => r.source === source).length;
  const sessions = await prisma.studySession.findMany({ where: { endedAt: { gte: pet.createdAt } } });
  const studyMinutes = Math.round(sessions.reduce((t, s) => t + activeMs(s) / 60000, 0));
  const stats = { tasks: count("task"), steps: count("step"), goals: count("goal"), posts: count("post"), wins: count("win"), reviews: count("review"), books: count("book"), studyMinutes, streak, bestStreak };

  const badge = (id: string, label: string, desc: string, have: number, need: number) => ({ id, label, desc, unlocked: have >= need, progress: Math.min(1, have / need), have: Math.min(have, need), need });
  const badges = [
    badge("first", "First spark", "Earn your first point", rows.length, 1),
    badge("hatch", "Hatched", "Help your pet hatch", xp, AGES[1]?.at ?? 0),
    badge("tasks10", "Task tamer", "Finish 10 tasks", stats.tasks, 10),
    badge("tasks50", "Unstoppable", "Finish 50 tasks", stats.tasks, 50),
    badge("post1", "Out in the world", "Publish a LinkedIn post", stats.posts, 1),
    badge("post5", "Storyteller", "Publish 5 posts", stats.posts, 5),
    badge("study10", "Deep diver", "Study for 10 hours", studyMinutes, 600),
    badge("study50", "Knowledge keeper", "Study for 50 hours", studyMinutes, 3000),
    badge("streak3", "Three in a row", "3 days of progress in a row", bestStreak, 3),
    badge("streak7", "A whole week", "7 days of progress in a row", bestStreak, 7),
    badge("goal1", "Goal getter", "Reach a goal", stats.goals, 1),
    badge("book1", "Bookworm", "Finish a book", stats.books, 1),
    badge("wins10", "Proud of me", "Log 10 wins", stats.wins, 10),
    badge("review1", "Looking back", "Do a weekly review", stats.reviews, 1),
    badge("grown", "All grown up", "Reach the grown-up age", xp, AGES[9]?.at ?? 0),
    badge("legend", "Legend", `Reach ${LEGEND_XP} points`, xp, LEGEND_XP),
  ];

  const st: UnlockState = { xp, stats };
  const qp = await questProgress(prisma);
  const quests = QUESTS.map((q) => ({ ...q, have: Math.min(qp.have[q.id], q.need), done: qp.have[q.id] >= q.need }));
  const traits = pet.traits ? pet.traits.split(",").filter((t) => PERSONALITIES[t]) : [];

  return {
    pet: { ...pet, traits },
    outfit: parseOutfit(pet),
    xp, ...lv, stage: lv.level, age: lv.level, stageName: AGES[lv.level]?.name, mood, stats, badges,
    ages: AGES, legendAt: LEGEND_XP,
    items: ITEMS.map((i) => describe(i, st)),
    backdrops: BACKDROP_LIST.map((b) => describe(b, st)),
    patterns: PATTERN_LIST.map((p) => describe(p, st)),
    auras: AURA_LIST.map((a) => describe(a, st)),
    personalities: Object.entries(PERSONALITIES).map(([id, p]) => ({ id, ...p })),
    perks: perkSummary(traits),
    maxTraits: MAX_TRAITS,
    today: { xp: rows.filter((r) => localDay(r.createdAt) === today).reduce((t, r) => t + r.amount, 0), quests, allDone: quests.every((q) => q.done), allBonus: ALL_QUESTS_BONUS },
    points: { priority: PRIORITY_POINTS, other: { step: XP.step, goal: XP.goal, post: XP.post, win: XP.win, review: XP.review, skill: XP.skill, book: XP.book }, capture: CAPTURE },
    ageDays: Math.floor((Date.now() - pet.createdAt.getTime()) / 86400000),
    recent: rows.slice(0, 12).map((r) => ({ source: r.source, amount: r.amount, note: r.note, createdAt: r.createdAt })),
  };
}

// Checks the fields of a pet. `state` is the pet's current state (or ZERO_STATE when creating). Returns { data } or { error }.
type PetFields = Partial<Pick<Pet, "name" | "species" | "color" | "traits" | "bio" | "gender" | "backdrop" | "pattern" | "aura" | "outfit" | "style">>;
export type Cleaned<T> = { data: T; error?: undefined } | { error: string; data?: undefined };
// TODO(types): the request body gets a Zod schema when the pet module moves to Hono (P2-19).
export function cleanPet(b: UncheckedJson, state?: CleanState, partial?: false): Cleaned<PetFields & Pick<Pet, "name" | "species">>;
export function cleanPet(b: UncheckedJson, state: CleanState, partial: true): Cleaned<PetFields>;
export function cleanPet(b: UncheckedJson, state: CleanState = ZERO_STATE, partial = false): Cleaned<PetFields> {
  const d: PetFields = {};
  const has = (k: string) => b[k] !== undefined;
  if (!partial || has("name")) {
    const name = String(b.name || "").trim();
    if (!name) return { error: "Give your pet a name." };
    d.name = name.slice(0, 24);
  }
  if (!partial || has("species")) {
    if (!SPECIES.includes(b.species)) return { error: "Pick what kind of pet it is." };
    d.species = b.species;
  }
  if (!partial || has("color")) {
    if (!/^#[0-9a-fA-F]{6}$/.test(b.color || "")) return { error: "Pick a color." };
    d.color = b.color.toLowerCase();
  }
  if (has("traits")) {
    const t = (Array.isArray(b.traits) ? b.traits : []).filter((x) => PERSONALITIES[x]);
    d.traits = [...new Set(t)].slice(0, MAX_TRAITS).join(",");
  }
  if (has("bio")) d.bio = String(b.bio || "").slice(0, 200);
  const curGender = (state.pet && state.pet.gender) || "neutral";
  if (has("gender")) {
    if (!GENDERS.includes(b.gender)) return { error: "Pick boy, girl or either." };
    d.gender = b.gender;
  }
  const gender = d.gender || curGender;

  // backdrop, pattern and aura: must exist and be unlocked (what she already uses stays allowed)
  const cur = state.pet || {};
  for (const [field, list, label] of [["backdrop", BACKDROP_LIST, "backdrop"], ["pattern", PATTERN_LIST, "pattern"], ["aura", AURA_LIST, "aura"]] as const) {
    if (!has(field)) continue;
    const e = findIn(list, b[field]);
    if (!e) return { error: `Unknown ${label}.` };
    if (cur[field] !== e.id && !unlockedRule(e.rule, state)) return { error: `The ${e.name.toLowerCase()} ${label} isn't unlocked yet. ${ruleLabel(e.rule)} to get it.` };
    d[field] = e.id;
  }

  // the outfit (the older single "style" is still understood and becomes an outfit item)
  let outfitIn: UncheckedJson | null = null;
  if (has("outfit") && b.outfit && typeof b.outfit === "object") outfitIn = b.outfit;
  else if (has("style") && b.style !== "none") { const legacy = LEGACY_STYLE[b.style]; outfitIn = legacy ? { [legacy[0]]: legacy[1] } : null; }
  else if (has("style")) outfitIn = {};
  if (outfitIn) {
    const worn = state.outfit || {};
    const out: Outfit = {};
    for (const slot of SLOTS) {
      const id = outfitIn[slot];
      if (!id) continue;
      const item = ITEM[id];
      if (!item || item.slot !== slot) return { error: "Unknown clothing item." };
      if (!fits(item, gender)) return { error: `${item.name} is for a ${item.for} pet.` };
      if (worn[slot] !== id && !unlockedRule(item.rule, state)) return { error: `${item.name} isn't unlocked yet. ${ruleLabel(item.rule)} to get it.` };
      out[slot] = id;
    }
    d.outfit = JSON.stringify(out);
    d.style = "none";
  } else if (d.gender && d.gender !== curGender) {
    // changing gender takes off anything that no longer fits
    const kept: Outfit = {};
    for (const slot of SLOTS) { const id = state.outfit?.[slot]; const item = id ? ITEM[id] : undefined; if (id && item && fits(item, d.gender)) kept[slot] = id; }
    d.outfit = JSON.stringify(kept);
  }
  return { data: d };
}
