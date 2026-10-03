import { type AiGateway, prompts } from "@hyperfocus/ai";
import { clockIn } from "../clock.ts";
import { log } from "../log.ts";
import { getSettings } from "../notify.ts";
import type { Db } from "../types.ts";

// A saved job reaches the rest of the app (P6-30): its closing day goes on the calendar with a reminder two days
// before, "Prepare" makes a task with small steps (written by the AI when it is set up, a plain list otherwise), and the
// skills it asks for that you don't have yet go on your Skills map. Each happens once per match.

type Posting = { title: string; company: string; url: string; expiresAt: Date };
type MatchRef = { id: number; eventId: number | null; reminderId: number | null; taskId: number | null; posting: Posting & { id: number } };

const DAY = 24 * 60 * 60 * 1000;
const named = (p: Posting) => `${p.title}${p.company ? ` at ${p.company}` : ""}`;

/** The closing day on the calendar, and a reminder two days before (or in an hour, when that is already past). */
export async function deadlineToCalendar(db: Db, m: MatchRef, now = new Date()): Promise<{ eventId: number; reminderId: number }> {
  if (m.eventId && m.reminderId) return { eventId: m.eventId, reminderId: m.reminderId };
  const p = m.posting;
  const { timeZone } = await getSettings(db);
  const event = m.eventId ?? (await db.event.create({
    data: { title: `Last day to apply: ${named(p)}`, day: clockIn(timeZone, p.expiresAt).day, allDay: true, category: "work", notes: p.url },
  })).id;
  const at = new Date(Math.max(p.expiresAt.getTime() - 2 * DAY, now.getTime() + 60 * 60 * 1000));
  const reminder = m.reminderId ?? (await db.reminder.create({ data: { title: `Apply to ${named(p)}`, note: p.url, at } })).id;
  await db.jobMatch.updateMany({ where: { id: m.id }, data: { eventId: event, reminderId: reminder } });
  return { eventId: event, reminderId: reminder };
}

const PLAIN_STEPS = [
  "Open the job post and read it once, slowly",
  "Underline the three things they want most",
  "Update your CV so those three show first",
  "Write a short cover letter: why them, why you",
  "Send the application",
];

/** "Prepare": a task due two days before the closing day, with steps. */
export async function prepareTask(db: Db, ai: AiGateway, m: MatchRef, now = new Date()): Promise<{ taskId: number; ai: boolean }> {
  if (m.taskId && (await db.task.count({ where: { id: m.taskId } }))) return { taskId: m.taskId, ai: false };
  const p = m.posting;
  let steps = PLAIN_STEPS;
  let fromAi = false;
  try {
    const out = await ai.run(prompts.taskSteps, { task: `Prepare and send my job application for ${named(p)}.` });
    if (out.length) [steps, fromAi] = [out, true];
  } catch (err) {
    log.info({ err: (err as Error).message }, "Prepare: AI not available, plain steps used");
  }
  const { timeZone } = await getSettings(db);
  const due = new Date(Math.max(p.expiresAt.getTime() - 2 * DAY, now.getTime()));
  const task = await db.task.create({ data: { title: `Apply: ${named(p)}`, priority: "high", dueDay: clockIn(timeZone, due).day } });
  await db.step.createMany({ data: steps.map((text) => ({ text, taskId: task.id })) });
  await db.jobMatch.updateMany({ where: { id: m.id }, data: { taskId: task.id } });
  return { taskId: task.id, ai: fromAi };
}

/** The skills the job asks for that are not on your Skills map yet: added (linked to the standard skill). */
export async function skillGaps(db: Db, m: MatchRef): Promise<{ added: string[]; have: string[] }> {
  const ids = (await db.jobPostingSkill.findMany({ where: { postingId: m.posting.id }, select: { skillId: true } })).map((s) => s.skillId);
  const asked = await db.taxonomySkill.findMany({ where: { id: { in: ids } }, select: { code: true, name: true }, orderBy: { name: "asc" } });
  const mine = await db.skill.findMany({ select: { name: true, taxonomyCode: true } });
  const codes = new Set(mine.map((s) => s.taxonomyCode).filter(Boolean));
  const names = new Set(mine.map((s) => s.name.trim().toLowerCase()));
  const have: string[] = [];
  const added: string[] = [];
  for (const s of asked) {
    if (codes.has(s.code) || names.has(s.name.toLowerCase())) {
      have.push(s.name);
      continue;
    }
    await db.skill.create({ data: { name: s.name, area: "From Job Radar", target: 3, notes: `Asked for by ${named(m.posting)}`, taxonomyCode: s.code, taxonomyLabel: s.name } });
    added.push(s.name);
  }
  return { added, have };
}
