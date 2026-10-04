import { type AiGateway, type AiProvider, createAiGateway, deepSeek, type Person } from "@hyperfocus/ai";
import { appAi, own } from "./credentials.ts";
import { config } from "./config.ts";
import { log } from "./log.ts";

// The API's one AI gateway (P2-05, packages/ai): DeepSeek from the config, switched off in the demo. Modules get it
// through `deps.ai` and run the prompt templates from @hyperfocus/ai with it.

export type { AiMessage } from "@hyperfocus/ai";

/**
 * DeepSeek with the person's own key (Settings → Connections). Otherwise the app's DEEPSEEK_API_KEY, but only for the
 * owner (local mode, or ADMIN_EMAILS), or for everyone when SHARE_AI_KEY is on: nobody else spends the owner's credit.
 */
function personalDeepSeek(): AiProvider {
  const current = () => {
    const mine = own("deepseek");
    if (mine) return deepSeek({ ...config.deepseek, apiKey: mine.apiKey });
    return deepSeek(appAi() === "none" ? { ...config.deepseek, apiKey: "" } : config.deepseek);
  };
  const missing = config.mode === "cloud" ? "To use the AI, add your own DeepSeek API key in Settings → Connections (\"How do I get this?\" shows how)." : "The AI isn't set up: add your DeepSeek API key in Settings → Connections (or DEEPSEEK_API_KEY in the .env file).";
  return { name: "deepseek", unavailable: () => (current().unavailable() ? missing : null), complete: (request) => current().complete(request) };
}

/** Is the AI usable for the person asking (their key or the app's)? */
export const aiReady = () => !personalDeepSeek().unavailable();

/** Who is asking, for the prompts: their own profile (set once at start-up; read inside their request, so the
 * tenancy guard returns their row). Without it the prompts describe them in general terms. */
let personSource: (() => Promise<Person | null>) | null = null;
export const usePersonSource = (source: (() => Promise<Person | null>) | null) => {
  personSource = source;
};

export const ai: AiGateway = createAiGateway({
  person: async () => (personSource ? await personSource() : null),
  requireProfile: config.mode === "cloud", // (local mode: the owner alone, as before)
  provider: personalDeepSeek(), // DEEPSEEK_URL overrides the address only for tests
  disabled: config.demo ? "The AI is switched off in this demo, so nobody can spend someone else's credits." : undefined,
  onRetry: ({ template, attempt, error }) => log.warn({ template, attempt, err: error.message }, "AI call failed, trying again"),
});
