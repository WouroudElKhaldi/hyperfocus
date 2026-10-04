import { jsonTemplate, lenient, object, objects, systemAndUser, text } from "../template.ts";
import { PERSON } from "../person.ts";

// The calendar: turn a sentence into an event, and plan study blocks in their free time. The replies are only read here;
// the calendar code checks them against the real clock and their free windows (never trust the AI with the clock).

export const parseEvent = jsonTemplate({
  name: "parseEvent",
  temperature: 0.1,
  messages: ({ text: sentence, today, weekday, categories, repeats }: { text: string; today: string; weekday: string; categories: readonly string[]; repeats: readonly string[] }) =>
    systemAndUser(
      `You turn a short sentence into a calendar event. Today is ${today} (${weekday}). Resolve words like "tomorrow", "Friday" or "next week" from today.
Rules: if no time is given, set "allDay" to true and leave startTime/endTime empty. If a start time is given without a length, make it 1 hour. Times are 24-hour "HH:mm". "category" is one of: ${categories.join(", ")} (study for learning/courses, work for job things, health for doctor/sport, personal for the rest, else event). "repeat" is one of: ${repeats.join(", ")} ("every Monday" = weekly, "every day" = daily, "weekdays" = weekdays). Keep the title short and in their words. Never invent details they didn't say.
Reply ONLY with JSON: {"title": string, "day": "YYYY-MM-DD", "allDay": boolean, "startTime": string, "endTime": string, "category": string, "repeat": string, "location": string}.`,
      sentence,
    ),
  reply: object({ title: text(), day: text(), allDay: lenient(Boolean), startTime: text(), endTime: text(), category: text(), repeat: text(), location: text() }),
});

export type FreeWindow = { day: string; from: string; to: string };

export const planStudy = jsonTemplate({
  name: "planStudy",
  temperature: 0.4,
  messages: (facts: { today: string; freeWindows: FreeWindow[]; studyMinutesLast7Days: number; goals: string[]; biggestSkillGaps: string[]; openTasks: string[] }) =>
    systemAndUser(
      `You help ${PERSON} Plan realistic study blocks for the next 7 days.
Choose 3 to 5 blocks ONLY inside the free windows given. Rules: each block 25 to 90 minutes; at most 2 blocks per day; leave at least 2 days with nothing or only one short block so they can rest; prefer a gentle start (short first block, not a huge one); never put a block outside its window. "title" starts with a verb and says what to do, using their goals, skill gaps, tasks or course work given (never invent courses). "why" is one short kind sentence.
Reply ONLY with JSON: {"blocks": [{"day": "YYYY-MM-DD", "start": "HH:mm", "minutes": number, "title": string, "why": string}]}.`,
      JSON.stringify(facts),
    ),
  reply: object({ blocks: objects({ day: text(), start: text(), minutes: lenient((v) => Math.round(Number(v))), title: text(), why: text() }) }),
  after: (out) => out.blocks,
});
