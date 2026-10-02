import { type AiGateway, createAiGateway, deepSeek } from "@hyperfocus/ai";
import { config } from "./config.ts";
import { log } from "./log.ts";

// The API's one AI gateway (P2-05, packages/ai): DeepSeek from the config, switched off in the demo. Modules get it
// through `deps.ai` and run the prompt templates from @hyperfocus/ai with it.

export type { AiMessage } from "@hyperfocus/ai";

export const ai: AiGateway = createAiGateway({
  provider: deepSeek(config.deepseek), // DEEPSEEK_URL overrides the address only for tests
  disabled: config.demo ? "The AI is switched off in this demo, so nobody can spend someone else's credits." : undefined,
  onRetry: ({ template, attempt, error }) => log.warn({ template, attempt, err: error.message }, "AI call failed, trying again"),
});
