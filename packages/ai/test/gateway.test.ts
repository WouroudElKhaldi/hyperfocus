import { describe, expect, it } from "vitest";
import { AiError, type AiProvider, type AiRequest, createAiGateway, deepSeek, prompts } from "../src/index.ts";

// The gateway and the DeepSeek adapter, with fake providers: no network, no credits.

/** A provider that answers from a script: each entry is a reply, or an error to throw. */
function scripted(...answers: (string | Error)[]) {
  const calls: AiRequest[] = [];
  const provider: AiProvider = {
    name: "fake",
    unavailable: () => null,
    async complete(request) {
      calls.push(request);
      const next = answers.shift() ?? "";
      if (next instanceof Error) throw next;
      return next;
    },
  };
  return { provider, calls };
}
const fast = { retryDelayMs: 1 };
const failure = (status: number, message: string, retry: boolean) => new AiError(status, message, { retry });

describe("gateway", () => {
  it("runs a template: its messages, temperature and JSON mode, and the reply read by its schema", async () => {
    const { provider, calls } = scripted(JSON.stringify({ steps: ["Open it", 2] }));
    const steps = await createAiGateway({ provider, ...fast }).run(prompts.taskSteps, { task: "clean room" });
    expect(steps).toEqual(["Open it", "2"]);
    expect(calls[0]).toMatchObject({ temperature: 0.7, json: true });
    expect(calls[0]?.messages.at(-1)).toEqual({ role: "user", content: "clean room" });
  });

  it("asks for plain text for the chats", async () => {
    const { provider, calls } = scripted("Hello.");
    const ai = createAiGateway({ provider });
    expect(await ai.run(prompts.companionReply, { history: [], message: "hi", context: "" })).toBe("Hello.");
    expect(calls[0]?.json).toBe(false);
  });

  it("refuses when switched off (the demo) or when the provider can't be used, without calling it", async () => {
    const { provider, calls } = scripted("x");
    await expect(createAiGateway({ provider, disabled: "Off in the demo." }).text([])).rejects.toMatchObject({ status: 403, message: "Off in the demo." });
    const noKey = { ...provider, unavailable: () => "Key missing." };
    await expect(createAiGateway({ provider: noKey }).text([])).rejects.toMatchObject({ status: 400, message: "Key missing." });
    expect(calls).toHaveLength(0);
  });

  it("retries failures that can pass, then succeeds", async () => {
    const { provider, calls } = scripted(failure(502, "busy", true), failure(502, "busy", true), "ok");
    const retried: number[] = [];
    const ai = createAiGateway({ provider, ...fast, onRetry: ({ attempt }) => retried.push(attempt) });
    expect(await ai.text([])).toBe("ok");
    expect(calls).toHaveLength(3);
    expect(retried).toEqual([1, 2]);
  });

  it("gives up after the last retry, and never retries what can't pass", async () => {
    const busy = scripted(failure(502, "busy", true), failure(502, "busy", true), failure(502, "still busy", true), "never reached");
    await expect(createAiGateway({ provider: busy.provider, ...fast }).text([])).rejects.toMatchObject({ status: 502, message: "still busy" });
    expect(busy.calls).toHaveLength(3);
    const badKey = scripted(failure(502, "DeepSeek error 401: bad key", false), "never reached");
    await expect(createAiGateway({ provider: badKey.provider, ...fast }).text([])).rejects.toMatchObject({ message: "DeepSeek error 401: bad key" });
    expect(badKey.calls).toHaveLength(1);
  });

  it("stops waiting after the timeout (504) and doesn't retry it", async () => {
    let calls = 0;
    const slow: AiProvider = {
      name: "slow",
      unavailable: () => null,
      complete: ({ signal }) => {
        calls++;
        return new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
      },
    };
    await expect(createAiGateway({ provider: slow, timeoutMs: 20, ...fast }).text([])).rejects.toMatchObject({ status: 504 });
    expect(calls).toBe(1);
  });

  it("reports a reply that isn't JSON as 502", async () => {
    const { provider } = scripted("not json");
    await expect(createAiGateway({ provider }).run(prompts.taskSteps, { task: "x" })).rejects.toMatchObject({
      status: 502, message: "AI returned something I couldn't read. Try again.",
    });
  });

  it("an unexpected error from a provider becomes a 502 AiError", async () => {
    const { provider } = scripted(new TypeError("boom"));
    await expect(createAiGateway({ provider }).text([])).rejects.toMatchObject({ status: 502, message: "The AI failed: boom" });
  });
});

describe("DeepSeek adapter", () => {
  const settings = { apiKey: "k", url: "http://ai/chat", model: "deepseek-chat" };
  const answer = (status: number, body: unknown) => async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  const request = { messages: [{ role: "user", content: "hi" }], temperature: 0.3, json: true, signal: new AbortController().signal };

  it("sends the key, model, temperature and JSON mode, and returns the text", async () => {
    let sent: { url: string; init: RequestInit } | undefined;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      sent = { url, init };
      return new Response(JSON.stringify({ choices: [{ message: { content: "reply" } }] }));
    }) as unknown as typeof fetch;
    expect(await deepSeek(settings, fetchImpl).complete(request)).toBe("reply");
    expect(sent?.url).toBe("http://ai/chat");
    expect((sent?.init.headers as Record<string, string> | undefined)?.Authorization).toBe("Bearer k");
    expect(JSON.parse(String(sent?.init.body))).toEqual({ model: "deepseek-chat", messages: request.messages, temperature: 0.3, response_format: { type: "json_object" } });
  });

  it("is unavailable without a key", () => {
    expect(deepSeek({ ...settings, apiKey: "" }).unavailable()).toMatch(/DEEPSEEK_API_KEY is missing/);
    expect(deepSeek(settings).unavailable()).toBeNull();
  });

  it("marks overload and server errors as worth retrying, but not a bad key", async () => {
    const fail = (status: number) => deepSeek(settings, answer(status, "nope") as unknown as typeof fetch).complete(request);
    await expect(fail(500)).rejects.toMatchObject({ status: 502, retry: true, message: "DeepSeek error 500: nope" });
    await expect(fail(429)).rejects.toMatchObject({ retry: true });
    await expect(fail(401)).rejects.toMatchObject({ retry: false });
  });

  it("treats a dropped connection as worth retrying", async () => {
    const offline = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    await expect(deepSeek(settings, offline).complete(request)).rejects.toMatchObject({ status: 502, retry: true });
  });
});
