import { playbookPrompt } from "./playbook.js";

const URL = process.env.DEEPSEEK_URL || "https://api.deepseek.com/chat/completions"; // the override is only for tests

export async function chat(messages, { json = false, temperature = 0.7 } = {}) {
  if (process.env.DEMO_MODE) {
    const e = new Error("The AI is switched off in this demo, so nobody can spend someone else's credits.");
    e.status = 403;
    throw e;
  }
  const key = process.env.DEMO_MODE ? "" : process.env.DEEPSEEK_API_KEY;
  if (!key) {
    const e = new Error("DEEPSEEK_API_KEY is missing. Add it to apps/api/.env and restart.");
    e.status = 400;
    throw e;
  }
  const res = await fetch(process.env.DEEPSEEK_URL || URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      messages,
      temperature,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const e = new Error(`DeepSeek error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    e.status = 502;
    throw e;
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!json) return text;
  try {
    return JSON.parse(text);
  } catch {
    const e = new Error("AI returned something I couldn't read. Try again.");
    e.status = 502;
    throw e;
  }
}

const VOICE = `You help a 21-year-old woman software engineer (3 years of experience, moving from mid to senior level, currently in a program called SE Square / Software Engineer Excellence) write LinkedIn posts.
Voice: genuine, warm, confident, humble, first person, curious. Not corporate, not cringe, no "I'm thrilled to announce", no buzzword soup.`;

const RULES = `HARD RULES:
- Keep her ideas, facts, opinions and topic exactly. Rephrase and structure only. NEVER invent experiences, numbers, names, results or claims she did not state.
- Short paragraphs, white space, plain language. 900-1400 characters unless she asks otherwise.
- At most 3 relevant hashtags at the end, at most 1-2 emojis. Avoid overusing em-dashes.
- Write in the same language as her original thought.
- Names of people, programs and companies: use ONLY what she wrote, spelled exactly as she wrote them. Never add a surname, title or affiliation she did not give.
- If her thought or draft contains an @mention (like @Sami), keep it exactly as written, in the same place in the sentence. Do not remove it, expand it or turn it into a hashtag.`;

export async function rewritePost({ thought, draft, instruction }) {
  const system = `${VOICE}\n${RULES}\n${playbookPrompt()}\nReply ONLY with JSON: {"draft": string, "hookType": string, "hooks": string[], "suggestions": string[]}.
"hookType" = the name of the hook pattern you used. "hooks" = 3 alternative opening lines for the same post, each a DIFFERENT pattern from the playbook, each under 140 characters, each true to her thought. "suggestions" = 3 short, specific ideas she could apply next (something to add, something to cut). When she gives an edit instruction, keep the hook unless she asks to change it.`;
  const user = instruction
    ? `Her original thought (source of truth):\n"""${thought}"""\n\nCurrent draft:\n"""${draft}"""\n\nHer instruction for the edit: ${instruction}\nApply it to the current draft and return the full updated draft.`
    : `Her original thought:\n"""${thought}"""\n\nTurn it into a LinkedIn post.`;
  const out = await chat([{ role: "system", content: system }, { role: "user", content: user }], { json: true });
  return {
    draft: String(out.draft ?? ""),
    hookType: String(out.hookType ?? ""),
    hooks: Array.isArray(out.hooks) ? out.hooks.map(String) : [],
    suggestions: Array.isArray(out.suggestions) ? out.suggestions.map(String) : [],
  };
}

export async function analyzeGoal({ goal, targetDate, today, studyHours14d, existingActions }) {
  const out = await chat(
    [
      {
        role: "system",
        content: `${VOICE}
You are a warm but HONEST coach helping her set a goal. She has ADHD/autism traits, anxiety and procrastination, and is also very capable. Do not flatter and do not scare her; be realistic.
Tasks:
1. "refined": rewrite her goal as one clear, specific, measurable sentence in first person. Keep her meaning and scope exactly. Do not add targets, numbers or deadlines she did not state (you may use her target date).
2. "verdict": one of "achievable", "stretch" (possible but needs consistent effort or a change), "unrealistic" (not possible as stated by that date).
3. "verdictNote": 2-4 sentences explaining the verdict, using the facts given (today's date, target date, her recent study hours). If information is missing, say what you are assuming.
4. "suggestion": if not plainly achievable, a concrete adjustment (a realistic date or a smaller scope). Otherwise a short encouraging next move. One or two sentences.
5. "actions": 4-7 concrete steps of HOW to do it, in order, each under 14 words, starting with a verb. The first must be tiny and easy. Do not repeat steps she already has.
Reply ONLY with JSON: {"refined": string, "verdict": string, "verdictNote": string, "suggestion": string, "actions": string[]}.`,
      },
      {
        role: "user",
        content: `Goal (her words): """${goal}"""
Target date: ${targetDate || "not set"}
Today: ${today}
Hours she studied in the last 14 days for her program (from her own log): ${studyHours14d}
Steps she already has: ${existingActions.length ? existingActions.join("; ") : "none"}`,
      },
    ],
    { json: true, temperature: 0.4 },
  );
  const verdict = ["achievable", "stretch", "unrealistic"].includes(out.verdict) ? out.verdict : "stretch";
  return {
    refined: String(out.refined ?? ""),
    verdict,
    verdictNote: String(out.verdictNote ?? ""),
    suggestion: String(out.suggestion ?? ""),
    actions: Array.isArray(out.actions) ? out.actions.map(String) : [],
  };
}

export async function postIdeas({ course, part, notes }) {
  const out = await chat(
    [
      {
        role: "system",
        content: `${VOICE}
She just finished a study session and wrote notes. Suggest 3 DIFFERENT LinkedIn post ideas based ONLY on those notes (and the course and part names). Use three different angles, for example: a lesson she learned, a personal honest moment or struggle, a question she wants to ask her network, a mistake or misconception she had, or a before/after in her thinking.
Never invent experiences, results or facts that are not in the notes. If the notes are thin, keep each idea small and honest.
For each idea give "angle" (2-4 words) and "thought": a rough first-person paragraph in HER voice (3-6 short sentences, plain words, a bit raw) that she can then polish into a post. It is a seed, not a finished post.
Reply ONLY with JSON: {"ideas": [{"angle": string, "thought": string}]} with exactly 3 items.`,
      },
      { role: "user", content: `Course: ${course || "(none)"}\nPart: ${part || "(none)"}\nMy notes:\n"""${notes}"""` },
    ],
    { json: true, temperature: 0.7 },
  );
  return (out.ideas || []).slice(0, 3).map((i) => ({ angle: String(i.angle ?? ""), thought: String(i.thought ?? "") })).filter((i) => i.thought);
}

export async function winsSummary(wins) {
  const out = await chat(
    [
      {
        role: "system",
        content: `You turn a list of a software engineer's real wins into honest talking points for a performance review, a promotion conversation, or her CV. She tends to undersell herself, so be specific and confident, but NEVER inflate: use only what is in the list, do not invent numbers, results, impact or technologies, and do not claim more than the entries say.
Write past-tense achievement statements, each one concrete (what she did, and the amount or frequency when the list shows it). Group repeated things together (for example many study sessions become one statement with the total).
Reply ONLY with JSON: {"bullets": string[] (5-8), "paragraph": string (3-4 sentences in first person she could say out loud)}.`,
      },
      { role: "user", content: wins.map((w) => `${w.date.slice(0, 10)} [${w.kind}] ${w.text}`).join("\n") },
    ],
    { json: true, temperature: 0.3 },
  );
  return { bullets: (out.bullets || []).map(String), paragraph: String(out.paragraph ?? "") };
}

export async function stuckHelp({ energy, blocker, todayTasks, openTasks, studying }) {
  const out = await chat(
    [
      {
        role: "system",
        content: `You are a calm, warm body-double for a young software engineer with ADHD/autism traits, anxiety and procrastination. She pressed "I'm stuck". Help her START, nothing more.
Rules: no lecture, no productivity clichés, no pressure, never say "just". Validate the feeling in one short sentence. Give ONE first step that takes under 2 minutes and is physical and concrete (e.g. "open the file and read the first line aloud"). Also give an even smaller fallback in case she is still stuck. If her energy is low, prefer easy or low-stakes options. If one of her existing tasks fits her energy, name it exactly as written, otherwise leave "pick" empty. Use only the tasks given; never invent tasks.
Reply ONLY with JSON: {"validation": string (one short, warm sentence that acknowledges how she feels, in second person), "step": string, "ifStillStuck": string, "pick": string}.`,
      },
      {
        role: "user",
        content: `Energy: ${energy}\nWhat's in the way (her words): ${blocker?.trim() || "(she didn't say)"}\nTasks for today: ${todayTasks.join("; ") || "none"}\nOther open tasks: ${openTasks.join("; ") || "none"}\nStudying right now: ${studying ? "yes" : "no"}`,
      },
    ],
    { json: true, temperature: 0.6 },
  );
  return { validation: String(out.validation ?? ""), step: String(out.step ?? ""), ifStillStuck: String(out.ifStillStuck ?? ""), pick: String(out.pick ?? "") };
}

export async function suggestSkills({ context, existing }) {
  const out = await chat(
    [
      {
        role: "system",
        content: `You help a software engineer with 3 years of experience (front end, back end and UI/UX) grow from mid-level to senior. She finds it hard to name her own weak spots.
From what she describes, suggest 5-8 specific skills worth working on, like a senior engineer would need. Base them on her words first, then on what mid-level engineers commonly still lack. Be concrete ("Designing REST APIs" not "Backend"). Do not repeat skills she already tracks.
Reply ONLY with JSON: {"skills": [{"name": string (max 6 words), "area": string (one of: Design & architecture, Code quality, Data & databases, Delivery & DevOps, Security & performance, Communication & leadership, Product & UX, Other), "why": string (one short sentence tied to what she said)}]}.`,
      },
      { role: "user", content: `What she said:\n"""${context}"""\nSkills she already tracks: ${existing.length ? existing.join("; ") : "none"}` },
    ],
    { json: true, temperature: 0.5 },
  );
  return (out.skills || []).map((s) => ({ name: String(s.name), area: String(s.area || "Other"), why: String(s.why || "") })).filter((s) => s.name);
}

export async function skillPlan({ name, level, target }) {
  const out = await chat(
    [
      {
        role: "system",
        content: `You help a software engineer with ADHD/autism traits and anxiety close a skill gap on her way from mid to senior. She is at level ${level}/5 and wants level ${target}/5 in this skill.
Give 4-5 concrete steps in order, each under 14 words, starting with a verb. The first step must take under 10 minutes and feel easy. Then suggest up to 2 well-known books that genuinely exist and are about this skill: only books you are sure exist, real title and real author. If you are not sure, return an empty list.
Reply ONLY with JSON: {"steps": string[], "books": [{"title": string, "author": string}]}.`,
      },
      { role: "user", content: name },
    ],
    { json: true, temperature: 0.4 },
  );
  return {
    steps: (out.steps || []).map(String),
    books: (out.books || []).map((b) => ({ title: String(b.title), author: String(b.author || "") })).filter((b) => b.title).slice(0, 2),
  };
}

// Raw thoughts can be full of typos, so the allowed amount of change is a bit more generous than for a finished draft.
export async function polishDraft(draft, maxDrift = 0.25) {
  const out = await chat(
    [
      {
        role: "system",
        content: `You are a proofreader. Make the SMALLEST possible edits to a text that will become a LinkedIn post.
You MUST fix EVERY spelling mistake, typo, wrong word (like "weak" for "week"), missing or wrong capital letter (including a lowercase "i"), grammar slip and punctuation error. Do not leave any of them. Do not rewrite or rephrase anything else.
Allowed: fix spelling, typos, grammar, punctuation, capitalization, repeated words, and ALSO smooth clearly awkward, unnatural or unclear phrasing with the smallest change possible (swap or add a few words, e.g. "I might be the 1st place as a perfectionist" -> "I might be the number one perfectionist", or "got my attention very much" -> "really caught my attention"). Do this wherever a native speaker would wince, but keep her ideas, sentence order and voice.
Forbidden: changing the structure, order, hook, tone, meaning, length (keep within about 10%), line breaks, emojis, hashtags, names, @mentions, or adding/removing any sentence. Do not "improve" style. Keep her voice and her own word choices.
If it is already clean, return it exactly unchanged.
Reply ONLY with JSON: {"draft": string, "changes": string[]} where "changes" lists each edit briefly, like "teh -> the" (empty array if none).`,
      },
      { role: "user", content: draft },
    ],
    { json: true, temperature: 0.1 },
  );
  const result = String(out.draft ?? "");
  const drift = Math.abs(result.length - draft.length) / Math.max(draft.length, 1);
  if (!result.trim() || drift > maxDrift) {
    const e = new Error("The AI changed too much for a tiny polish, so I kept your draft as it is. Try again.");
    e.status = 502;
    throw e;
  }
  return { draft: result, changes: Array.isArray(out.changes) ? out.changes.map(String) : [] };
}

export async function taskSteps(task) {
  const out = await chat(
    [
      {
        role: "system",
        content: `You help someone with ADHD/autism, anxiety and procrastination start tasks. Break the task into 3-6 tiny, concrete, physical actions. The first step must take under 2 minutes and feel almost silly-easy. Each step starts with a verb, max 12 words. Reply ONLY with JSON: {"steps": string[]}.`,
      },
      { role: "user", content: task },
    ],
    { json: true },
  );
  return (out.steps || []).map(String);
}

export async function organize(text) {
  const out = await chat(
    [
      {
        role: "system",
        content: `You sort a messy brain dump into separate items. Do not change her meaning. Each item: {"kind": "task" | "post_idea" | "project_idea" | "note", "title": short title (max 8 words), "body": her words for that item, lightly cleaned}. Reply ONLY with JSON: {"items": [...]}.`,
      },
      { role: "user", content: text },
    ],
    { json: true, temperature: 0.3 },
  );
  return Array.isArray(out.items) ? out.items : [];
}
