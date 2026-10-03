import { type AiGateway, type AiProvider, createAiGateway, deepSeek } from "@hyperfocus/ai";
import { own } from "./credentials.ts";
import { config } from "./config.ts";
import { log } from "./log.ts";

// The API's one AI gateway (P2-05, packages/ai): DeepSeek from the config, switched off in the demo. Modules get it
// through `deps.ai` and run the prompt templates from @hyperfocus/ai with it.

export type { AiMessage } from "@hyperfocus/ai";

/** DeepSeek with the person's own key (Settings → Connections), otherwise the app's DEEPSEEK_API_KEY. */
function personalDeepSeek(): AiProvider {
  const current = () => {
    const mine = own("deepseek");
    return deepSeek(mine ? { ...config.deepseek, apiKey: mine.apiKey } : config.deepseek);
  };
  const missing = config.mode === "cloud" ? "The AI isn't set up: add your DeepSeek API key in Settings → Connections." : "The AI isn't set up: add your DeepSeek API key in Settings → Connections (or DEEPSEEK_API_KEY in the .env file).";
  return { name: "deepseek", unavailable: () => (current().unavailable() ? missing : null), complete: (request) => current().complete(request) };
}

/** Is the AI usable for the person asking (their key or the app's)? */
export const aiReady = () => !personalDeepSeek().unavailable();

export const ai: AiGateway = createAiGateway({
  provider: personalDeepSeek(), // DEEPSEEK_URL overrides the address only for tests
  disabled: config.demo ? "The AI is switched off in this demo, so nobody can spend someone else's credits." : undefined,
  onRetry: ({ template, attempt, error }) => log.warn({ template, attempt, err: error.message }, "AI call failed, trying again"),
});
