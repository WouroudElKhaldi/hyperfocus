import http from "node:http";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { startExtraApi } from "../support/extra-api.js";
import { freePort } from "../support/stack.js";
import { CLOUD, signUp } from "../support/people.js";

// P5-09: "Connect LinkedIn" per person, each with their own LinkedIn app (its Client ID and Secret saved in Settings). A stand-in LinkedIn (consent → code → token, who you are, the Posts API) shows
// each person's post goes to their own LinkedIn, as them, with LinkedIn's required headers; that it comes before their
// n8n webhook; and what happens when the connection has run out or LinkedIn refuses it.

const posts = [];
const APPS = { bobsapp001: "bob-secret-1", annsapp002: "ann-secret-2" }; // the LinkedIn apps people made themselves
const tokenRequests = [];
const people = { "code-bob": { sub: "bob-member", name: "Bob Li", token: "li-token-bob", expires: 5184000 }, "code-ann": { sub: "ann-member", name: "Ann Li", token: "li-token-ann", expires: 5184000 }, "code-old": { sub: "old-member", name: "Old", token: "li-token-old", expires: 0 }, "code-revoked": { sub: "rev-member", name: "Rev", token: "li-token-revoked", expires: 5184000 } };
let linkedin, api, bob, ann, cy, dee;
const n8n = inject("n8nUrl");

beforeAll(async () => {
  const port = await freePort();
  linkedin = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      const json = (status, data) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
      const auth = req.headers.authorization ?? "";
      const who = Object.values(people).find((p) => auth === `Bearer ${p.token}`);
      if (req.url === "/oauth/accessToken") {
        const p = Object.fromEntries(new URLSearchParams(body));
        if (APPS[p.client_id] !== p.client_secret) return json(401, { error: "invalid_client" });
        tokenRequests.push({ code: p.code, client: p.client_id });
        const person = people[p.code];
        return person ? json(200, { access_token: person.token, expires_in: person.expires, scope: "openid,profile,w_member_social" }) : json(400, { error: "invalid_request", error_description: "The code is no good." });
      }
      if (req.url === "/v2/userinfo") return who ? json(200, { sub: who.sub, name: who.name }) : json(401, {});
      if (req.url === "/rest/posts") {
        if (!who || who.token === "li-token-revoked") return json(401, { message: "revoked" });
        posts.push({ as: who.sub, headers: req.headers, body: JSON.parse(body) });
        res.writeHead(201, { "x-restli-id": `urn:li:share:${posts.length}` });
        return res.end();
      }
      json(404, {});
    });
  });
  await new Promise((r) => linkedin.listen(port, "127.0.0.1", r));
  const base = `http://127.0.0.1:${port}`;
  api = await startExtraApi("linkedin", { ...CLOUD, LINKEDIN_OAUTH_URL: `${base}/oauth`, LINKEDIN_API_URL: base, LINKEDIN_API_VERSION: "202609" });
  [bob, ann, cy, dee] = await Promise.all(["bob", "ann", "cy", "dee"].map((n) => signUp(api, `${n}-li@example.com`, n)));
  // each person saves their own LinkedIn app (Ann a different one from the others)
  for (const p of [bob, cy, dee]) await p.json("PUT", "/api/integrations/linkedin-app", { clientId: "bobsapp001", clientSecret: "bob-secret-1" });
  await ann.json("PUT", "/api/integrations/linkedin-app", { clientId: "annsapp002", clientSecret: "ann-secret-2" });
}, 120000);
afterAll(async () => {
  await api?.stop();
  linkedin?.close();
});

async function connect(person, code, stateOverride) {
  const { url } = await person.json("GET", "/api/integrations/linkedin/start");
  const state = stateOverride ?? new URL(url).searchParams.get("state");
  const r = await person.call("GET", `/api/integrations/linkedin/callback?code=${code}&state=${encodeURIComponent(state)}`);
  return decodeURIComponent(r.headers.get("location"));
}
async function publish(person, text) {
  const p = await person.json("POST", "/api/posts", { thought: "t", draft: text });
  const r = await person.call("POST", `/api/posts/${p.id}/publish`);
  return { status: r.status, body: await r.json() };
}

describe("Connect LinkedIn", () => {
  it("needs the person's own LinkedIn app first, then asks LinkedIn with that app's id and the way back", async () => {
    const nobody = await signUp(api, "no-app-li@example.com", "NoApp");
    const r = await nobody.call("GET", "/api/integrations/linkedin/start");
    expect(r.status).toBe(409);
    expect((await r.json()).error).toContain("First save your LinkedIn app");
    expect((await nobody.call("PUT", "/api/integrations/linkedin-app", { clientId: "x", clientSecret: "short" })).status).toBe(400);
    const { url } = await bob.json("GET", "/api/integrations/linkedin/start");
    const q = new URL(url).searchParams;
    expect(url).toMatch(/\/oauth\/authorization\?/);
    expect(q.get("client_id")).toBe("bobsapp001");
    expect(new URL((await ann.json("GET", "/api/integrations/linkedin/start")).url).searchParams.get("client_id")).toBe("annsapp002");
    expect(q.get("redirect_uri")).toBe("http://localhost:5999/api/integrations/linkedin/callback");
    expect(q.get("scope")).toBe("openid profile w_member_social");
  });

  it("refuses a way back that isn't genuine, cancelled, or with a bad code", async () => {
    expect(await connect(bob, "code-bob", "x.y")).toBe("/backup?connect-error=That link isn't from Hyperfocus.&for=linkedin");
    expect(decodeURIComponent((await bob.call("GET", "/api/integrations/linkedin/callback?error=user_cancelled_authorize")).headers.get("location"))).toBe("/backup?connect-error=You didn't allow it, so nothing changed.&for=linkedin");
    expect(await connect(bob, "nonsense")).toBe("/backup?connect-error=The code is no good.&for=linkedin");
    expect((await bob.json("GET", "/api/integrations")).map((i) => i.provider)).toEqual(["linkedin-app"]);
  });

  it("two people each post on their own LinkedIn, as themselves; it comes before their n8n webhook", async () => {
    expect(await connect(bob, "code-bob")).toBe("/backup?connected=linkedin");
    expect(await connect(ann, "code-ann")).toBe("/backup?connected=linkedin");
    // each came in through their own app
    expect(tokenRequests.filter((t) => ["code-bob", "code-ann"].includes(t.code)).map((t) => [t.code, t.client])).toEqual([["code-bob", "bobsapp001"], ["code-ann", "annsapp002"]]);
    await bob.json("PUT", "/api/integrations/n8n", { webhookUrl: `${n8n}/bobs-n8n` });
    expect(await bob.json("GET", "/api/integrations")).toEqual(expect.arrayContaining([expect.objectContaining({ provider: "linkedin", account: "Bob Li" })]));
    expect((await bob.json("GET", "/api/me")).connected.linkedin).toBe(true);

    expect((await publish(bob, "BOB ON LINKEDIN")).status).toBe(200);
    expect((await publish(ann, "ANN ON LINKEDIN")).status).toBe(200);
    const bobs = posts.find((p) => p.body.commentary === "BOB ON LINKEDIN");
    expect(bobs).toMatchObject({ as: "bob-member", body: { author: "urn:li:person:bob-member", visibility: "PUBLIC", lifecycleState: "PUBLISHED" } });
    expect(bobs.headers["linkedin-version"]).toBe("202609");
    expect(bobs.headers["x-restli-protocol-version"]).toBe("2.0.0");
    expect(posts.find((p) => p.body.commentary === "ANN ON LINKEDIN")).toMatchObject({ as: "ann-member", body: { author: "urn:li:person:ann-member" } });
    // not also through n8n
    const viaN8n = await fetch(`${n8n}/__control/requests`).then((r) => r.json());
    expect(JSON.stringify(viaN8n)).not.toContain("BOB ON LINKEDIN");
  });

  it("says to connect again when the connection ran out or LinkedIn no longer accepts it", async () => {
    await connect(cy, "code-old");
    const out = await publish(cy, "CY");
    expect(JSON.stringify(out.body)).toContain("Your LinkedIn connection ran out");
    await connect(dee, "code-revoked");
    expect(JSON.stringify((await publish(dee, "DEE")).body)).toContain("Connect LinkedIn again");
    expect(posts.some((p) => ["CY", "DEE"].includes(p.body.commentary))).toBe(false);
  });

  it("disconnecting stops posting there", async () => {
    expect((await ann.call("DELETE", "/api/integrations/linkedin")).status).toBe(200);
    expect((await publish(ann, "ANN AFTER")).status).toBe(409); // nothing connected any more: the website shows Copy
  });
});
