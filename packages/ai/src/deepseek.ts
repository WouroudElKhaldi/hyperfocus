import { AiError, type AiProvider } from "./types.ts";

// The DeepSeek adapter. DeepSeek speaks the OpenAI chat-completions format, so another OpenAI-compatible provider is a
// copy of this file with its own name and messages.

export type DeepSeekSettings = { apiKey: string; url: string; model: string };

export function deepSeek({ apiKey, url, model }: DeepSeekSettings, fetchImpl: typeof fetch = fetch): AiProvider {
  return {
    name: "deepseek",
    unavailable: () => (apiKey ? null : "DEEPSEEK_API_KEY is missing. Add it to the .env file at the project root and restart."),
    async complete({ messages, temperature, json, signal }) {
      let res: Response;
      try {
        res = await fetchImpl(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, messages, temperature, ...(json ? { response_format: { type: "json_object" } } : {}) }),
          signal,
        });
      } catch (e) {
        if (signal.aborted) throw e; // the gateway's timeout: it reports that itself
        throw new AiError(502, "Can't reach DeepSeek. Check your internet connection and try again.", { retry: true });
      }
      if (!res.ok) {
        // too many requests and the provider's own failures can pass; anything else (a bad key, a bad request) won't
        const retry = res.status === 429 || res.status >= 500;
        throw new AiError(502, `DeepSeek error ${res.status}: ${(await res.text()).slice(0, 300)}`, { retry });
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return data.choices?.[0]?.message?.content ?? "";
    },
  };
}
