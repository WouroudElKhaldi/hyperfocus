import { type AiGateway, createAiGateway, deepSeek, prompts } from "@hyperfocus/ai";
import { config } from "./config.ts";
import { log } from "./log.ts";

// The API's one AI gateway (P2-05, packages/ai): DeepSeek from the config, switched off in the demo. Hono modules get it
// through `deps.ai`; the code that hasn't moved to Hono yet uses the functions below, which keep their old names.

export type { AiMessage } from "@hyperfocus/ai";

export const ai: AiGateway = createAiGateway({
  provider: deepSeek(config.deepseek), // DEEPSEEK_URL overrides the address only for tests
  disabled: config.demo ? "The AI is switched off in this demo, so nobody can spend someone else's credits." : undefined,
  onRetry: ({ template, attempt, error }) => log.warn({ template, attempt, err: error.message }, "AI call failed, trying again"),
});

type In<T> = T extends { messages: (input: infer I) => unknown } ? I : never;

export const rewritePost = (input: In<typeof prompts.rewritePost>) => ai.run(prompts.rewritePost, input);
export const polishDraft = (draft: string, maxDrift?: number) => ai.run(prompts.polishDraft, { draft, ...(maxDrift === undefined ? {} : { maxDrift }) });
export const postIdeas = (input: In<typeof prompts.postIdeas>) => ai.run(prompts.postIdeas, input);
export const taskSteps = (task: string) => ai.run(prompts.taskSteps, { task });
export const organize = (text: string) => ai.run(prompts.organize, { text });
export const stuckHelp = (input: In<typeof prompts.stuckHelp>) => ai.run(prompts.stuckHelp, input);
export const suggestSkills = (input: In<typeof prompts.suggestSkills>) => ai.run(prompts.suggestSkills, input);
export const skillPlan = (input: In<typeof prompts.skillPlan>) => ai.run(prompts.skillPlan, input);
export const winsSummary = (wins: In<typeof prompts.winsSummary>["wins"]) => ai.run(prompts.winsSummary, { wins });
