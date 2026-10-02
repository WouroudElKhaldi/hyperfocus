// The gateway's building blocks: messages, providers and the error every AI failure becomes.

/** One message in a conversation with the AI. */
export type AiMessage = { role: string; content: string };

/** What a provider is asked to do: one chat completion. */
export type AiRequest = {
  messages: AiMessage[];
  temperature: number;
  /** Ask for a JSON object (the provider's JSON mode). */
  json: boolean;
  /** Aborts the call (the gateway's timeout). */
  signal: AbortSignal;
};

/** A provider (Adapter): turns one request into the model's text. DeepSeek today; others plug in the same way. */
export type AiProvider = {
  name: string;
  /** Says why the provider can't be used (like a missing key), or null when it can. */
  unavailable(): string | null;
  complete(request: AiRequest): Promise<string>;
};

/**
 * Every AI failure. `status` is the HTTP status the API answers with (the problem middleware reads it), and
 * `retry` says whether trying again could help (a network hiccup or an overloaded provider, never a bad key).
 */
export class AiError extends Error {
  readonly status: number;
  readonly retry: boolean;
  constructor(status: number, message: string, { retry = false }: { retry?: boolean } = {}) {
    super(message);
    this.name = "AiError";
    this.status = status;
    this.retry = retry;
  }
}
