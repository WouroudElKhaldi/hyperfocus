// Who the AI is helping. Prompts never describe a fixed person: they put PERSON where the person goes, and the gateway
// fills it in, for each call, from the profile of whoever is asking (their name, what they do or study, where they
// are, what they wrote about themselves). Nothing is assumed beyond what they wrote: not their age, gender, job or
// health.

export const PERSON = "{{PERSON}}";

export type Person = { name?: string; role?: string; location?: string; about?: string; helps?: string };

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
  return `${who}.${about}${helps} Fit your help to their work or studies as they describe them; when you don't know their field, keep it general. Refer to them as "they" unless they say otherwise.`;
}

/** Puts the person into every message that has the PERSON slot. */
export const fillPerson = <M extends { content: string }>(messages: M[], description: string): M[] =>
  messages.map((m) => (m.content.includes(PERSON) ? { ...m, content: m.content.split(PERSON).join(description) } : m));
