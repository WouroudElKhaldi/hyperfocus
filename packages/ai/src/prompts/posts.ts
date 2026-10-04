import { AiError } from "../types.ts";
import { PERSON } from "../person.ts";
import { jsonTemplate, object, objects, systemAndUser, text, texts } from "../template.ts";
import { playbookPrompt } from "./playbook.ts";

// LinkedIn posts: rewrite a thought into a post, proofread a draft, and turn study notes into post ideas.

export const VOICE = `You help ${PERSON} Write LinkedIn posts for them.
Voice: genuine, warm, confident, humble, first person, curious. Not corporate, not cringe, no "I'm thrilled to announce", no buzzword soup.`;

const RULES = `HARD RULES:
- Keep their ideas, facts, opinions and topic exactly. Rephrase and structure only. NEVER invent experiences, numbers, names, results or claims they did not state.
- Short paragraphs, white space, plain language. 900-1400 characters unless they ask otherwise.
- At most 3 relevant hashtags at the end, at most 1-2 emojis. Avoid overusing em-dashes.
- Write in the same language as their original thought.
- Names of people, programs and companies: use ONLY what they wrote, spelled exactly as they wrote them. Never add a surname, title or affiliation they did not give.
- If their thought or draft contains an @mention (like @Sami), keep it exactly as written, in the same place in the sentence. Do not remove it, expand it or turn it into a hashtag.`;

export const rewritePost = jsonTemplate({
  name: "rewritePost",
  temperature: 0.7,
  messages: ({ thought, draft, instruction }: { thought: string; draft?: string | undefined; instruction?: string | undefined }) => {
    const system = `${VOICE}\n${RULES}\n${playbookPrompt()}\nReply ONLY with JSON: {"draft": string, "hookType": string, "hooks": string[], "suggestions": string[]}.
"hookType" = the name of the hook pattern you used. "hooks" = 3 alternative opening lines for the same post, each a DIFFERENT pattern from the playbook, each under 140 characters, each true to their thought. "suggestions" = 3 short, specific ideas they could apply next (something to add, something to cut). When they give an edit instruction, keep the hook unless they ask to change it.`;
    const user = instruction
      ? `Their original thought (source of truth):\n"""${thought}"""\n\nCurrent draft:\n"""${draft}"""\n\nTheir instruction for the edit: ${instruction}\nApply it to the current draft and return the full updated draft.`
      : `Their original thought:\n"""${thought}"""\n\nTurn it into a LinkedIn post.`;
    return systemAndUser(system, user);
  },
  reply: object({ draft: text(), hookType: text(), hooks: texts(), suggestions: texts() }),
});

// Raw thoughts can be full of typos, so the allowed amount of change is a bit more generous than for a finished draft.
export const polishDraft = jsonTemplate({
  name: "polishDraft",
  temperature: 0.1,
  messages: ({ draft }: { draft: string; maxDrift?: number }) =>
    systemAndUser(
      `You are a proofreader. Make the SMALLEST possible edits to a text that will become a LinkedIn post.
You MUST fix EVERY spelling mistake, typo, wrong word (like "weak" for "week"), missing or wrong capital letter (including a lowercase "i"), grammar slip and punctuation error. Do not leave any of them. Do not rewrite or rephrase anything else.
Allowed: fix spelling, typos, grammar, punctuation, capitalization, repeated words, and ALSO smooth clearly awkward, unnatural or unclear phrasing with the smallest change possible (swap or add a few words, e.g. "I might be the 1st place as a perfectionist" -> "I might be the number one perfectionist", or "got my attention very much" -> "really caught my attention"). Do this wherever a native speaker would wince, but keep their ideas, sentence order and voice.
Forbidden: changing the structure, order, hook, tone, meaning, length (keep within about 10%), line breaks, emojis, hashtags, names, @mentions, or adding/removing any sentence. Do not "improve" style. Keep their voice and their own word choices.
If it is already clean, return it exactly unchanged.
Reply ONLY with JSON: {"draft": string, "changes": string[]} where "changes" lists each edit briefly, like "teh -> the" (empty array if none).`,
      draft,
    ),
  reply: object({ draft: text(), changes: texts() }),
  // a proofread must stay a proofread: an empty answer or one that changed the length a lot is refused
  after: (out, { draft, maxDrift = 0.25 }) => {
    const drift = Math.abs(out.draft.length - draft.length) / Math.max(draft.length, 1);
    if (!out.draft.trim() || drift > maxDrift) throw new AiError(502, "The AI changed too much for a tiny polish, so I kept your draft as it is. Try again.");
    return out;
  },
});

export const postIdeas = jsonTemplate({
  name: "postIdeas",
  temperature: 0.7,
  messages: ({ course, part, notes }: { course: string; part: string; notes: string }) =>
    systemAndUser(
      `${VOICE}
They just finished a study session and wrote notes. Suggest 3 DIFFERENT LinkedIn post ideas based ONLY on those notes (and the course and part names). Use three different angles, for example: a lesson they learned, a personal honest moment or struggle, a question they want to ask their network, a mistake or misconception they had, or a before/after in their thinking.
Never invent experiences, results or facts that are not in the notes. If the notes are thin, keep each idea small and honest.
For each idea give "angle" (2-4 words) and "thought": a rough first-person paragraph in THEIR voice (3-6 short sentences, plain words, a bit raw) that they can then polish into a post. It is a seed, not a finished post.
Reply ONLY with JSON: {"ideas": [{"angle": string, "thought": string}]} with exactly 3 items.`,
      `Course: ${course || "(none)"}\nPart: ${part || "(none)"}\nMy notes:\n"""${notes}"""`,
    ),
  reply: object({ ideas: objects({ angle: text(), thought: text() }) }),
  after: (out) => out.ideas.slice(0, 3).filter((i) => i.thought),
});
