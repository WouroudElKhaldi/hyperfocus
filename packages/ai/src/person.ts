// Who the AI is helping. Prompts never describe a fixed person: they put PERSON where the person goes, and the gateway
// fills it in, for each call, from the profile of whoever is asking (their name, what they do or study, where they
// are, what they wrote about themselves). Nothing is assumed beyond what they wrote: not their age, gender, job or
// health.

export const PERSON = "{{PERSON}}";

export type Person = {
  name?: string; role?: string; location?: string; about?: string; helps?: string;
  // P5-14, from the welcome guide or Profile; all optional
  pronouns?: string; studyLevel?: string; major?: string; school?: string; studyYear?: string; situation?: string;
  neuro?: string[]; neuroNote?: string; supports?: string[]; tone?: string; bestTime?: string; focusMins?: number;
};

const LEVEL: Record<string, string> = { school: "at school", diploma: "studying for a diploma", bachelor: "doing a bachelor's degree", master: "doing a master's degree", phd: "doing a PhD", bootcamp: "in a bootcamp or course", self: "learning on their own", none: "not studying right now" };
const SITUATION: Record<string, string> = { studying: "studying", working: "working", both: "studying and working", looking: "looking for a job", other: "" };
const NEURO_NAME: Record<string, string> = { adhd: "ADHD", autism: "autism", dyslexia: "dyslexia", dyscalculia: "dyscalculia", dyspraxia: "dyspraxia", anxiety: "anxiety", depression: "depression", ocd: "OCD", bipolar: "bipolar disorder", ptsd: "PTSD", chronic: "a chronic illness or chronic pain", unsure: "not sure, but some of these feel familiar" };
const SUPPORT: Record<string, string> = { smallSteps: "very small steps", reminders: "reminders", timers: "timers", checklists: "checklists", examples: "concrete examples", bodyDouble: "working alongside someone", breaks: "regular breaks", routine: "a set routine", quiet: "quiet, fewer distractions", visual: "visual layouts", deadlines: "clear deadlines", rewards: "small rewards" };
const TONE: Record<string, string> = { gentle: "gentle and warm", direct: "short and direct, no fluff", playful: "light and playful" };
const PRONOUN: Record<string, string> = { she: "she/her", he: "he/him", they: "they/them" };

/** What they told us about their studies, brain and preferences, as plain sentences ("" when they said nothing). */
function aboutThem(p: Person): string {
  const out: string[] = [];
  const level = p.studyLevel ? LEVEL[p.studyLevel] : "";
  const study = [level, p.major?.trim() && `in ${p.major.trim()}`, p.school?.trim() && `at ${p.school.trim()}`, p.studyYear && (p.studyYear === "last" ? "(final year)" : `(year ${p.studyYear})`)].filter(Boolean).join(" ");
  if (study) out.push(`Studies: ${study}.`);
  const sit = p.situation ? SITUATION[p.situation] : "";
  if (sit) out.push(`Right now they are ${sit}.`);
  const neuro = (p.neuro ?? []).map((n) => NEURO_NAME[n]).filter(Boolean);
  const note = p.neuroNote?.trim().slice(0, 300);
  if (neuro.length || note)
    out.push(`They chose to share how their brain works: ${[neuro.join(", "), note && `"${note}"`].filter(Boolean).join("; ")}. Use this only to shape how you help (format, step size, pacing, wording); don't bring it up unless they do, don't diagnose, and never treat it as a limit.`);
  const supports = (p.supports ?? []).map((s) => SUPPORT[s]).filter(Boolean);
  if (supports.length) out.push(`What helps them: ${supports.join(", ")}.`);
  if (p.tone && TONE[p.tone]) out.push(`They like replies that are ${TONE[p.tone]}.`);
  if (p.bestTime) out.push(`They focus best in the ${p.bestTime}.`);
  if (p.focusMins) out.push(`They can usually focus for about ${p.focusMins} minutes at a time: size suggestions to fit.`);
  return out.length ? ` ${out.join(" ")}` : "";
}

const NOBODY_YET = "a person using a planning and focus app made for people who find it hard to start, focus or keep track (for example with ADHD traits, anxiety or procrastination; never assume they have any of these)";

/** One paragraph about them for the prompts; always refer to them as "they" unless they say otherwise. */
export function describePerson(p: Person | null | undefined): string {
  const parts = [
    p?.name?.trim() && `named ${p.name.trim()}`,
    p?.role?.trim() && `who describes what they do or study as "${p.role.trim()}"`,
    p?.location?.trim() && `based in ${p.location.trim()}`,
  ].filter(Boolean);
  const who = parts.length ? `a person ${parts.join(", ")}, using a planning and focus app made for people who find it hard to start, focus or keep track (never assume a diagnosis)` : NOBODY_YET;
  const about = p?.about?.trim() ? ` In their own words, about themselves: "${p.about.trim().slice(0, 600)}".` : "";
  const helps = p?.helps?.trim() ? ` What helps them, in their own words: "${p.helps.trim().slice(0, 400)}".` : "";
  const pronoun = p?.pronouns && PRONOUN[p.pronouns] ? `Refer to them as ${PRONOUN[p.pronouns]}.` : `Refer to them as "they" unless they say otherwise.`;
  return `${who}.${about}${helps}${p ? aboutThem(p) : ""} Fit your help to their work or studies as they describe them; when you don't know their field, keep it general. ${pronoun}`;
}

/** Puts the person into every message that has the PERSON slot. */
export const fillPerson = <M extends { content: string }>(messages: M[], description: string): M[] =>
  messages.map((m) => (m.content.includes(PERSON) ? { ...m, content: m.content.split(PERSON).join(description) } : m));
