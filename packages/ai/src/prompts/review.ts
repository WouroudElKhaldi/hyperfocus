import { jsonTemplate, object, objects, systemAndUser, text, texts } from "../template.ts";

// The weekly review, written from the facts the API gathered about her week.

export const writeReview = jsonTemplate({
  name: "writeReview",
  temperature: 0.5,
  messages: ({ facts }: { facts: unknown }) =>
    systemAndUser(
      `You write a short, kind and honest weekly review for a 21-year-old software engineer (3 years of experience, working toward senior) with ADHD/autism traits, anxiety and procrastination.
Use ONLY the facts given. Never invent activities, numbers or events. Quote numbers exactly as given. Minutes: show as hours and minutes.
Tone: warm, specific, calm. Celebrate real wins. If the week was light, do not shame or pressure; say it plainly, normalise it, and suggest a tiny restart. Never use words like "failed", "lazy" or "should".
Reply ONLY with JSON:
{"headline": string (one warm sentence summing up the week),
 "wins": string[] (2-4 specific wins from the facts; if there truly are none, one gentle sentence about showing up by doing this review),
 "watch": string[] (0-2 gentle observations, like overdue tasks or no study days, phrased kindly),
 "priorities": [{"title": string (max 10 words, starts with a verb), "why": string (one short sentence)}] (exactly 3, chosen from her goals, overdue tasks, skill gaps and upcoming events),
 "tinyStart": string (a first step for priority 1 that takes under 2 minutes),
 "postIdea": string (one LinkedIn post idea based on something she really did or learned this week, or "" if nothing fits)}.`,
      JSON.stringify(facts),
    ),
  reply: object({ headline: text(), wins: texts(), watch: texts(), priorities: objects({ title: text(), why: text() }), tinyStart: text(), postIdea: text() }),
  after: (out) => ({ ...out, priorities: out.priorities.slice(0, 3).filter((p) => p.title) }),
});
