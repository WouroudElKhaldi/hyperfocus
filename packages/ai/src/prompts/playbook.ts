// The LinkedIn playbook that gets injected into every AI rewrite.
// Edit this file freely (the server restarts itself). Add your own best-performing hooks to MY_HOOKS.

export const HOOKS = [
  { name: "Personal story / vulnerable admission", formula: "I [honest admission or moment] and [what happened].", example: "I burned my first three sourdough loaves and almost gave up baking." },
  { name: "Contrarian statement", formula: "[Common belief] is wrong. / Unpopular opinion: ...", example: "Waking up at 5am is overrated." },
  { name: "Curiosity gap", formula: "I stopped/started [thing]. Here's what changed.", example: "I stopped checking my phone at dinner. My sleep changed." },
  { name: "Specific number", formula: "[Real number] + [result or lesson] (ONLY if she gave the number)", example: "10 minutes of stretching a day taught me more about discipline than any book." },
  { name: "Direct question", formula: "A question that makes the reader check themselves.", example: "Do you actually enjoy your weekends, or just recover from them?" },
  { name: "Bold lesson-first", formula: "State the lesson as the first line, story after.", example: "Speed is not the same as progress." },
  { name: "Pattern interrupt", formula: "A very short, surprising line, then a line break.", example: "I failed my driving test.\n\nTwice." },
  { name: "Before / after", formula: "Then I believed X. Now I believe Y.", example: "Before: I thought fitness meant suffering. Now: I think it means showing up." },
  { name: "Mistake confession", formula: "The mistake I made [doing X] (and what I'd do now).", example: "The mistake that cost me my first marathon." },
  { name: "Announcement with a twist", formula: "Announce it through the feeling or lesson, never 'I'm thrilled to announce'.", example: "I just signed up for a pottery class. I am terrible at it. Loving it." },
];

// Add hooks that worked for YOU here, plain text. The AI will copy their style (not their words).
export const MY_HOOKS: string[] = [];

export const HOOK_RULES = `
HOOK RULES (the opening decides whether anyone reads the rest):
- LinkedIn cuts posts after roughly 140 characters on mobile (about 210 on desktop) behind "see more". The hook must be complete, intriguing and valuable inside the first 140 characters, ideally under 12 words.
- Put the most interesting, surprising or valuable part of HER thought in the first line. Never start with "I'm excited/thrilled/humbled to announce", "Hi everyone", or a greeting.
- The hook must promise something the post actually delivers. No clickbait and no fake numbers.
- After the hook, leave a blank line. Then build the post; every paragraph is 1-2 lines.
- The examples below only show the SHAPE of each pattern. Never copy an example line; write a new hook from HER thought, using only what she actually said.
- Return exactly 3 alternative hooks, each from a different pattern, each something she could honestly say.
- Pick the ONE hook pattern below that fits her thought best, and use it.`;

export const STRUCTURE_RULES = `
POST STRUCTURE:
1. Hook (1-2 short lines)
2. Context or the honest moment (2-4 short lines)
3. The lesson or insight, in plain words (the core of her thought)
4. One concrete detail from HER thought that makes it real (never invent one)
5. A closing line with a genuine question for readers, to invite comments
6. At most 3 hashtags.`;

export function playbookPrompt() {
  const list = HOOKS.map((h, i) => `${i + 1}. ${h.name}: ${h.formula} e.g. "${h.example}"`).join("\n");
  const mine = MY_HOOKS.length ? `\nHooks that performed well for her (match the style):\n${MY_HOOKS.map((h) => `- ${h}`).join("\n")}` : "";
  return `${HOOK_RULES}\nTOP 10 HOOK PATTERNS:\n${list}${mine}\n${STRUCTURE_RULES}`;
}
