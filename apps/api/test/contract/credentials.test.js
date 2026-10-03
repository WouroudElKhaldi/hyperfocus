import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { startExtraApi } from "../support/extra-api.js";
import { CLOUD, signUp } from "../support/people.js";

// P5-07 (your request): each person saves their own DeepSeek key, n8n LinkedIn webhook and Gmail App Password, and the
// app uses them for that person's AI, posts and emails. Cloud mode, with the app's own n8n webhook set and NO app AI key:
// nobody without their own webhook may post through the app's, and the AI works only with a key.

const n8n = inject("n8nUrl");
const n8nCalls = () => fetch(`${n8n}/__control/requests`).then((r) => r.json());
const aiCalls = () => fetch(`${inject("aiUrl")}/__control/requests`).then((r) => r.json());
const KEY = "sk-bob-personal-key-9876";
let api, bob, alice;
beforeAll(async () => {
  api = await startExtraApi("credentials", { ...CLOUD, DEEPSEEK_API_KEY: " ", N8N_WEBHOOK_URL: `${n8n}/the-apps-own-webhook` });
  [bob, alice] = await Promise.all([signUp(api, "bob-creds@example.com", "Bob"), signUp(api, "alice-creds@example.com", "Alice")]);
}, 120000);
afterAll(async () => { await api?.stop(); });

describe("your own credentials", () => {
  it("without any: no AI, no posting (not even through the app's webhook), no email", async () => {
    expect((await bob.json("GET", "/api/me")).connected).toEqual({ ai: false, linkedin: false, email: false });
    const r = await bob.call("POST", "/api/ai/polish", { text: "teh text here" });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(await r.text()).toContain("Settings → Connections");
    const post = await bob.json("POST", "/api/posts", { thought: "t", draft: "BOB-NO-WEBHOOK" });
    expect((await bob.call("POST", `/api/posts/${post.id}/publish`)).status).toBe(409);
    expect(JSON.stringify(await n8nCalls())).not.toContain("BOB-NO-WEBHOOK");
    expect((await bob.json("GET", "/api/emails/status")).ready).toBe(false);
  });

  it("checks what is saved, and never sends a secret back", async () => {
    const bad = async (p, b) => { const r = await bob.call("PUT", `/api/integrations/${p}`, b); return [r.status, (await r.json()).error]; };
    expect(await bad("deepseek", { apiKey: "short" })).toEqual([400, expect.stringContaining("DeepSeek")]);
    expect(await bad("n8n", { webhookUrl: "not a url" })).toEqual([400, expect.stringContaining("webhook")]);
    expect(await bad("n8n", { webhookUrl: "ftp://x.example/hook" })).toEqual([400, expect.stringContaining("http")]);
    expect(await bad("gmail", { user: "bob@gmail.com", appKey: "too-short" })).toEqual([400, expect.stringContaining("16 letters")]);
    expect(await bad("gmail", { user: "nope", appKey: "abcdefghijklmnop" })).toEqual([400, expect.stringContaining("Gmail address")]);
    expect((await bob.call("PUT", "/api/integrations/something-else", { a: "b" })).status).toBe(404);

    expect(await bob.json("PUT", "/api/integrations/deepseek", { apiKey: KEY })).toMatchObject({ provider: "deepseek", account: "key ending in …9876" });
    expect(JSON.stringify(await bob.json("GET", "/api/integrations"))).not.toContain(KEY);
  });

  it("the AI uses your own key", async () => {
    expect((await bob.json("POST", "/api/ai/polish", { text: "teh text here" })).draft).toBeTruthy();
    const mine = (await aiCalls()).filter((c) => c.headers.authorization === `Bearer ${KEY}`);
    expect(mine.length).toBeGreaterThan(0);
    // Alice has no key and the app has none: still nothing for her
    expect((await alice.call("POST", "/api/ai/polish", { text: "teh text here" })).status).toBeGreaterThanOrEqual(400);
  });

  it("your posts go to your own n8n webhook", async () => {
    await bob.json("PUT", "/api/integrations/n8n", { webhookUrl: `${n8n}/bobs-webhook` });
    const post = await bob.json("POST", "/api/posts", { thought: "t", draft: "BOB-OWN-WEBHOOK" });
    expect((await bob.call("POST", `/api/posts/${post.id}/publish`)).status).toBe(200);
    const sent = (await n8nCalls()).filter((c) => JSON.stringify(c.body).includes("BOB-OWN-WEBHOOK"));
    expect(sent.map((c) => c.url)).toEqual(["/bobs-webhook"]);
    // Alice still can't post, through Bob's or the app's
    const hers = await alice.json("POST", "/api/posts", { thought: "t", draft: "ALICE-NO-WEBHOOK" });
    expect((await alice.call("POST", `/api/posts/${hers.id}/publish`)).status).toBe(409);
  });

  it("your emails go from your own Gmail (App Password spaces don't matter), and only yours", async () => {
    await bob.json("PUT", "/api/integrations/gmail", { user: "bob@gmail.com", appKey: "abcd efgh ijkl mnop" });
    expect(await bob.json("GET", "/api/emails/status")).toMatchObject({ ready: true, user: "bob@gmail.com" });
    expect((await alice.json("GET", "/api/emails/status")).ready).toBe(false);
    expect((await bob.json("GET", "/api/me")).connected).toEqual({ ai: true, linkedin: true, email: true });
    expect((await alice.json("GET", "/api/me")).connected).toEqual({ ai: false, linkedin: false, email: false });
  });

  it("disconnecting stops using it", async () => {
    expect((await bob.call("DELETE", "/api/integrations/deepseek")).status).toBe(200);
    expect((await bob.call("POST", "/api/ai/polish", { text: "teh text here" })).status).toBeGreaterThanOrEqual(400);
    expect((await bob.json("GET", "/api/me")).connected.ai).toBe(false);
  });
});

// the hosted app sends posts to the saved webhook, so it must be a public https address (never one of our machines)
describe("webhook addresses on the hosted app", () => {
  let strict, carol;
  beforeAll(async () => {
    strict = await startExtraApi("credentials_strict", { ...CLOUD, ALLOW_LOCAL_ADDRESSES: "" });
    carol = await signUp(strict, "carol-strict@example.com", "Carol");
  }, 120000);
  afterAll(async () => { await strict?.stop(); });

  it("refuses this machine and private networks, accepts a public https address", async () => {
    for (const webhookUrl of ["http://localhost:5678/webhook/x", "https://localhost/webhook/x", "https://127.0.0.1/x", "https://10.0.0.5/x", "https://192.168.1.20/x", "https://172.20.0.1/x", "https://169.254.169.254/latest", "https://n8n.local/x", "http://n8n.example.com/x", "https://[::1]/x", "https://[fd00::1]/x", "https://[::ffff:127.0.0.1]/x", "https://2130706433/x"]) {
      expect((await carol.call("PUT", "/api/integrations/n8n", { webhookUrl })).status, webhookUrl).toBe(400);
    }
    for (const webhookUrl of ["https://n8n.example.com/webhook/abc", "https://fdn8n.example.org/webhook/abc", "https://172.15.0.1/x"]) {
      expect((await carol.call("PUT", "/api/integrations/n8n", { webhookUrl })).status, webhookUrl).toBe(200);
    }
  });
});
