import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { get } from "../support/api.js";
import { startExtraApi } from "../support/extra-api.js";
import { CLOUD, signUp } from "../support/people.js";

// P5-10: a daily limit per person on the app's shared AI key, a friendly "come back tomorrow", and no limit for
// someone using their own key. Local mode: no limit.

const ASK = { text: "teh text here" };
let api, bob, alice;
beforeAll(async () => {
  api = await startExtraApi("ai_limits", { ...CLOUD, AI_DAILY_LIMIT: "2" });
  [bob, alice] = await Promise.all([signUp(api, "bob-limits@example.com", "Bob"), signUp(api, "alice-limits@example.com", "Alice")]);
}, 120000);
afterAll(async () => { await api?.stop(); });

describe("AI daily limits", () => {
  it("counts each person's requests and stops at the limit, kindly", async () => {
    expect(await bob.json("GET", "/api/ai/usage")).toMatchObject({ used: 0, limit: 2, ownKey: false, resetsAt: expect.stringMatching(/T00:00:00/) });
    await bob.json("POST", "/api/ai/polish", ASK);
    await bob.json("POST", "/api/ai/polish", ASK);
    const r = await bob.call("POST", "/api/ai/polish", ASK);
    expect(r.status).toBe(429);
    expect((await r.json()).error).toBe("You've used today's 2 AI requests. Come back tomorrow, or add your own DeepSeek key in Settings → Connections for no limit.");
    expect((await bob.json("GET", "/api/ai/usage")).used).toBe(2);
    // someone else has their own count
    expect((await alice.call("POST", "/api/ai/polish", ASK)).status).toBe(200);
    expect((await alice.json("GET", "/api/ai/usage")).used).toBe(1);
  });

  it("with your own key there is no limit, and nothing is counted", async () => {
    await bob.json("PUT", "/api/integrations/deepseek", { apiKey: "sk-bob-own-key-for-limits" });
    for (let i = 0; i < 3; i++) expect((await bob.call("POST", "/api/ai/polish", ASK)).status).toBe(200);
    expect(await bob.json("GET", "/api/ai/usage")).toMatchObject({ used: 2, ownKey: true });
  });
});

describe("AI limits in local mode", () => {
  it("has none", async () => {
    expect((await get("/api/ai/usage")).body).toMatchObject({ limit: 0, ownKey: false });
  });
});
