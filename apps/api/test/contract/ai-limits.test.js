import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { get } from "../support/api.js";
import { startExtraApi } from "../support/extra-api.js";
import { CLOUD, signUp } from "../support/people.js";

// P5-10: a daily limit per person on the app's shared AI key, a friendly "come back tomorrow", and no limit for
// someone using their own key. Local mode: no limit.

const ASK = { text: "teh text here" };
let api, bob, alice;
beforeAll(async () => {
  api = await startExtraApi("ai_limits", { ...CLOUD, SHARE_AI_KEY: "1", AI_DAILY_LIMIT: "2" }); // (the owner chose to share their key)
  [bob, alice] = await Promise.all([signUp(api, "bob-limits@example.com", "Bob"), signUp(api, "alice-limits@example.com", "Alice")]);
}, 120000);
afterAll(async () => { await api?.stop(); });

describe("AI daily limits", () => {
  it("counts each person's requests and stops at the limit, kindly", async () => {
    expect(await bob.json("GET", "/api/ai/usage")).toMatchObject({ used: 0, limit: 2, ownKey: false, shared: true, resetsAt: expect.stringMatching(/T00:00:00/) });
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

// the default: the owner's DeepSeek key is the owner's alone (SHARE_AI_KEY off)
describe("the owner's AI key is not shared", () => {
  let solo, owner, guest;
  beforeAll(async () => {
    solo = await startExtraApi("ai_owner_only", { ...CLOUD, ADMIN_EMAILS: "owner-ai@example.com" });
    [owner, guest] = await Promise.all([signUp(solo, "owner-ai@example.com", "Owner"), signUp(solo, "guest-ai@example.com", "Guest")]);
  }, 120000);
  afterAll(async () => { await solo?.stop(); });

  it("the owner uses it, without a limit; anyone else must add their own key", async () => {
    for (let i = 0; i < 3; i++) expect((await owner.call("POST", "/api/ai/polish", ASK)).status).toBe(200);
    expect((await owner.json("GET", "/api/me")).connected.ai).toBe(true);
    const r = await guest.call("POST", "/api/ai/polish", ASK);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toContain("add your own DeepSeek API key in Settings → Connections");
    expect((await guest.json("GET", "/api/me")).connected.ai).toBe(false);
    expect(await guest.json("GET", "/api/ai/usage")).toMatchObject({ shared: false, ownKey: false });
    await guest.json("PUT", "/api/integrations/deepseek", { apiKey: "sk-guest-own-key-123456" });
    expect((await guest.call("POST", "/api/ai/polish", ASK)).status).toBe(200);
  });
});
