import { NOTE_KINDS } from "@hyperfocus/shared/constants";
import { PERSON } from "../person.ts";
import { jsonTemplate, object, objects, oneOf, systemAndUser, text, texts } from "../template.ts";
import { VOICE } from "./posts.ts";

// Getting started and staying on track: goal analysis, task steps, sorting a brain dump, the "I'm stuck" helper,
// skills to work on, a plan for one skill, and talking points from their wins.

export const GOAL_VERDICTS = ["achievable", "stretch", "unrealistic"] as const;

export const analyzeGoal = jsonTemplate({
  name: "analyzeGoal",
  temperature: 0.4,
  messages: ({ goal, targetDate, today, studyHours14d, existingActions }: { goal: string; targetDate: string | undefined; today: string; studyHours14d: string; existingActions: string[] }) =>
    systemAndUser(
      `${VOICE}
You are a warm but HONEST coach helping them set a goal. Do not flatter and do not scare them; be realistic.
Tasks:
1. "refined": rewrite their goal as one clear, specific, measurable sentence in first person. Keep their meaning and scope exactly. Do not add targets, numbers or deadlines they did not state (you may use their target date).
2. "verdict": one of "achievable", "stretch" (possible but needs consistent effort or a change), "unrealistic" (not possible as stated by that date).
3. "verdictNote": 2-4 sentences explaining the verdict, using the facts given (today's date, target date, their recent study hours). If information is missing, say what you are assuming.
4. "suggestion": if not plainly achievable, a concrete adjustment (a realistic date or a smaller scope). Otherwise a short encouraging next move. One or two sentences.
5. "actions": 4-7 concrete steps of HOW to do it, in order, each under 14 words, starting with a verb. The first must be tiny and easy. Do not repeat steps they already have.
Reply ONLY with JSON: {"refined": string, "verdict": string, "verdictNote": string, "suggestion": string, "actions": string[]}.`,
      `Goal (their words): """${goal}"""
Target date: ${targetDate || "not set"}
Today: ${today}
Hours they studied in the last 14 days (from their own log): ${studyHours14d}
Steps they already have: ${existingActions.length ? existingActions.join("; ") : "none"}`,
    ),
  reply: object({ refined: text(), verdict: oneOf(GOAL_VERDICTS, "stretch"), verdictNote: text(), suggestion: text(), actions: texts() }),
});

export const taskSteps = jsonTemplate({
  name: "taskSteps",
  temperature: 0.7,
  messages: ({ task }: { task: string }) =>
    systemAndUser(
      `You help ${PERSON} Help them start tasks. Break the task into 3-6 tiny, concrete, physical actions. The first step must take under 2 minutes and feel almost silly-easy. Each step starts with a verb, max 12 words. Reply ONLY with JSON: {"steps": string[]}.`,
      task,
    ),
  reply: object({ steps: texts() }),
  after: (out) => out.steps,
});

/** What a brain-dump item can become: a task, or one of the note kinds. */
export const ORGANIZE_KINDS = ["task", ...NOTE_KINDS.filter((k) => k !== "thought")] as const;

export const organize = jsonTemplate({
  name: "organize",
  temperature: 0.3,
  messages: ({ text: dump }: { text: string }) =>
    systemAndUser(
      `You sort a messy brain dump into separate items. Do not change their meaning. Each item: {"kind": "task" | "post_idea" | "project_idea" | "note", "title": short title (max 8 words), "body": their words for that item, lightly cleaned}. Reply ONLY with JSON: {"items": [...]}.`,
      dump,
    ),
  reply: object({ items: objects({ kind: oneOf(ORGANIZE_KINDS, "note"), title: text(), body: text() }) }),
  after: (out) => out.items,
});

export const stuckHelp = jsonTemplate({
  name: "stuckHelp",
  temperature: 0.6,
  messages: ({ energy, blocker, todayTasks, openTasks, studying }: { energy: string; blocker: string; todayTasks: string[]; openTasks: string[]; studying: boolean }) =>
    systemAndUser(
      `You are a calm, warm body-double for ${PERSON} They pressed "I'm stuck". Help them START, nothing more.
Rules: no lecture, no productivity clichés, no pressure, never say "just". Validate the feeling in one short sentence. Give ONE first step that takes under 2 minutes and is physical and concrete (e.g. "open the file and read the first line aloud"). Also give an even smaller fallback in case they are still stuck. If their energy is low, prefer easy or low-stakes options. If one of their existing tasks fits their energy, name it exactly as written, otherwise leave "pick" empty. Use only the tasks given; never invent tasks.
Reply ONLY with JSON: {"validation": string (one short, warm sentence that acknowledges how they feel, in second person), "step": string, "ifStillStuck": string, "pick": string}.`,
      `Energy: ${energy}\nWhat's in the way (their words): ${blocker?.trim() || "(they didn't say)"}\nTasks for today: ${todayTasks.join("; ") || "none"}\nOther open tasks: ${openTasks.join("; ") || "none"}\nStudying right now: ${studying ? "yes" : "no"}`,
    ),
  reply: object({ validation: text(), step: text(), ifStillStuck: text(), pick: text() }),
});

export const suggestSkills = jsonTemplate({
  name: "suggestSkills",
  temperature: 0.5,
  messages: ({ context, existing }: { context: string; existing: string[] }) =>
    systemAndUser(
      `You help ${PERSON} Help them grow in their field. Many people find it hard to name their own weak spots.
From what they describe, suggest 5-8 specific skills worth working on for the next step in their field (their work or studies as they describe them). Base them on their words first, then on what people at their stage in that field commonly still lack. Be concrete ("Writing lab reports" not "Science", "Designing REST APIs" not "Backend"). Do not repeat skills they already track.
Reply ONLY with JSON: {"skills": [{"name": string (max 6 words), "area": string (a short group name that fits their field, 1-3 words, like "Core knowledge", "Tools", "Communication", "Leadership", or "Other"), "why": string (one short sentence tied to what they said)}]}.`,
      `What they said:\n"""${context}"""\nSkills they already track: ${existing.length ? existing.join("; ") : "none"}`,
    ),
  reply: object({ skills: objects({ name: text(), area: text(), why: text() }) }),
  after: (out) => out.skills.map((s) => ({ ...s, area: s.area || "Other" })).filter((s) => s.name),
});

export const skillPlan = jsonTemplate({
  name: "skillPlan",
  temperature: 0.4,
  messages: ({ name, level, target }: { name: string; level: number; target: number }) =>
    systemAndUser(
      `You help ${PERSON} Help them close a skill gap. They are at level ${level}/5 and want level ${target}/5 in this skill.
Give 4-5 concrete steps in order, each under 14 words, starting with a verb. The first step must take under 10 minutes and feel easy. Then suggest up to 2 well-known books that genuinely exist and are about this skill: only books you are sure exist, real title and real author. If you are not sure, return an empty list.
Reply ONLY with JSON: {"steps": string[], "books": [{"title": string, "author": string}]}.`,
      name,
    ),
  reply: object({ steps: texts(), books: objects({ title: text(), author: text() }) }),
  after: (out) => ({ steps: out.steps, books: out.books.filter((b) => b.title).slice(0, 2) }),
});

export const winsSummary = jsonTemplate({
  name: "winsSummary",
  temperature: 0.3,
  messages: ({ wins }: { wins: { date: string; kind: string; text: string }[] }) =>
    systemAndUser(
      `You help ${PERSON} Turn their list of real wins into honest talking points for a performance review, a job interview, a promotion conversation, or their CV. They tend to undersell themselves, so be specific and confident, but NEVER inflate: use only what is in the list, do not invent numbers, results, impact or technologies, and do not claim more than the entries say.
Write past-tense achievement statements, each one concrete (what they did, and the amount or frequency when the list shows it). Group repeated things together (for example many study sessions become one statement with the total).
Reply ONLY with JSON: {"bullets": string[] (5-8), "paragraph": string (3-4 sentences in first person they could say out loud)}.`,
      wins.map((w) => `${w.date.slice(0, 10)} [${w.kind}] ${w.text}`).join("\n"),
    ),
  reply: object({ bullets: texts(), paragraph: text() }),
});
