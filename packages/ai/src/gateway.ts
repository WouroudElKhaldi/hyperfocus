import { describePerson, fillPerson, PERSON, type Person } from "./person.ts";
import type { JsonTemplate, TextTemplate } from "./template.ts";
import { AiError, type AiMessage, type AiProvider } from "./types.ts";

// The AI gateway (P2-05): the one way the app talks to an AI. It picks the provider, refuses when the AI is switched off,
// gives up after a timeout, retries what can pass (a dropped connection, an overloaded provider) and reads replies with
// each template's schema, so callers always get the type they were promised.

export type GatewayOptions = {
  provider: AiProvider;
  /** When set, every call is refused with this message (the demo). */
  disabled?: string | undefined;
  /** How long one attempt may take. */
  timeoutMs?: number;
  /** How many times a failed attempt that can pass is tried again. */
  retries?: number;
  /** The wait before the first retry; it doubles each time. */
  retryDelayMs?: number;
  /** Told about each failed attempt that will be retried. */
  onRetry?: (info: { template: string; attempt: number; error: AiError }) => void;
  /** Who is asking (their profile), for the prompts' PERSON slot; missing = described in general terms. */
  person?: () => Promise<Person | null>;
  /** Cloud mode: no AI until the person has told us who they are (a name and what they do or study), so every answer fits them. */
  requireProfile?: boolean;
};

/** Enough about them for the AI to fit its help: a name, and what they do or study. */
export const profileReady = (p: Person | null | undefined) => !!p?.name?.trim() && !!(p.role?.trim() || p.major?.trim() || p.studyLevel || p.situation);
export const PROFILE_FIRST = "Fill in your profile first (Profile → your name, and what you do or study), so the AI can fit its help to you.";

export type CallOptions = { temperature?: number; name?: string };

export type AiGateway = {
  /** Plain text back. */
  text(messages: AiMessage[], options?: CallOptions): Promise<string>;
  /** Runs a prompt template: its messages, its temperature, its reply schema. */
  run<I>(template: TextTemplate<I>, input: I): Promise<string>;
  run<I, R, O>(template: JsonTemplate<I, R, O>, input: I): Promise<O>;
};

const UNREADABLE = "AI returned something I couldn't read. Try again.";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createAiGateway({ provider, disabled, timeoutMs = 90_000, retries = 2, retryDelayMs = 500, onRetry, person, requireProfile }: GatewayOptions): AiGateway {
  async function complete(name: string, given: AiMessage[], temperature: number, json: boolean): Promise<string> {
    if (disabled) throw new AiError(403, disabled);
    const why = provider.unavailable();
    if (why) throw new AiError(400, why);
    // the person the prompt is about: whoever is asking, from their own profile
    const who = await person?.().catch(() => null);
    if (requireProfile && !profileReady(who)) throw new AiError(400, PROFILE_FIRST);
    const messages = given.some((m) => m.content.includes(PERSON)) ? fillPerson(given, describePerson(who)) : given;
    for (let attempt = 0; ; attempt++) {
      const signal = AbortSignal.timeout(timeoutMs);
      try {
        return await provider.complete({ messages, temperature, json, signal });
      } catch (thrown) {
        // a timeout is not retried: she has already waited long enough
        if (signal.aborted) throw new AiError(504, "The AI took too long to answer. Try again in a moment.");
        const error = thrown instanceof AiError ? thrown : new AiError(502, `The AI failed: ${String((thrown as Error)?.message ?? thrown)}`);
        if (!error.retry || attempt >= retries) throw error;
        onRetry?.({ template: name, attempt: attempt + 1, error });
        await sleep(retryDelayMs * 2 ** attempt);
      }
    }
  }

  async function run<I, R, O>(template: TextTemplate<I> | JsonTemplate<I, R, O>, input: I): Promise<string | O> {
    const messages = template.messages(input);
    if (template.kind === "text") return complete(template.name, messages, template.temperature, false);
    const raw = await complete(template.name, messages, template.temperature, true);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new AiError(502, UNREADABLE);
    }
    const reply = template.reply.safeParse(parsed);
    if (!reply.success) throw new AiError(502, UNREADABLE);
    return template.after(reply.data, input);
  }

  return {
    text: (messages, { temperature = 0.7, name = "text" } = {}) => complete(name, messages, temperature, false),
    run: run as AiGateway["run"],
  };
}
