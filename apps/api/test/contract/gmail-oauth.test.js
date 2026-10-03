import http from "node:http";
import { SMTPServer } from "smtp-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startExtraApi } from "../support/extra-api.js";
import { freePort } from "../support/stack.js";
import { CLOUD, signUp } from "../support/people.js";

// P5-08: "Connect with Google" for Gmail, per person. A fake Google (consent → code → tokens, and token renewal) and a
// local mail server that accepts Google's XOAUTH2 login stand in for the real ones, so the acceptance check "sending from
// 2 test accounts works" runs here: each person's email leaves signed in as their own Gmail, with their own token.

const fakeGoogle = { requests: [] };
const smtp = { logins: [], mails: [] };
let google, mailServer, api, bob, alice;

const idToken = (email) => `x.${Buffer.from(JSON.stringify({ email })).toString("base64url")}.y`;
function startFakeGoogle(port) {
  google = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      const p = Object.fromEntries(new URLSearchParams(body));
      fakeGoogle.requests.push({ url: req.url, ...p });
      const json = (status, data) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
      if (req.url !== "/token" || p.client_id !== "client-1" || p.client_secret !== "secret-1") return json(401, { error: "invalid_client" });
      if (p.grant_type === "refresh_token") return json(200, { access_token: `renewed-${p.refresh_token}`, expires_in: 3600 });
      // the code says which test account consented; "short-" ones get a token that has already expired
      const [, short, email] = /^code-(short-)?(.+)$/.exec(p.code ?? "") ?? [];
      if (!email) return json(400, { error: "invalid_grant", error_description: "That code is no good." });
      return json(200, { access_token: `access-${email}`, refresh_token: `refresh-${email}`, expires_in: short ? 0 : 3600, id_token: idToken(email), scope: "openid email https://www.googleapis.com/auth/gmail.send" });
    });
  });
  return new Promise((r) => google.listen(port, "127.0.0.1", r));
}

beforeAll(async () => {
  const [gPort, sPort] = await Promise.all([freePort(), freePort()]);
  await startFakeGoogle(gPort);
  mailServer = new SMTPServer({
    authMethods: ["XOAUTH2"], authOptional: false, disabledCommands: ["STARTTLS"], logger: false,
    onAuth(auth, _session, cb) {
      smtp.logins.push({ user: auth.username, token: auth.accessToken });
      return auth.accessToken === `access-${auth.username}` || auth.accessToken === `renewed-refresh-${auth.username}` ? cb(null, { user: auth.username }) : cb(new Error("bad token"));
    },
    onData(stream, session, cb) {
      let raw = "";
      stream.on("data", (c) => { raw += c; });
      stream.on("end", () => { smtp.mails.push({ login: session.user, raw }); cb(); });
    },
  });
  await new Promise((r) => mailServer.listen(sPort, "127.0.0.1", r));
  api = await startExtraApi("gmail_oauth", { ...CLOUD, GOOGLE_CLIENT_ID: "client-1", GOOGLE_CLIENT_SECRET: "secret-1", GOOGLE_OAUTH_URL: `http://127.0.0.1:${gPort}`, GMAIL_SMTP: `127.0.0.1:${sPort}` });
  [bob, alice] = await Promise.all([signUp(api, "bob-google@example.com", "Bob"), signUp(api, "alice-google@example.com", "Alice")]);
}, 120000);
afterAll(async () => {
  await api?.stop();
  google?.close();
  await new Promise((r) => (mailServer ? mailServer.close(r) : r()));
});

/** Starts connecting, "consents" at Google with `code`, and follows the way back. Returns where it lands. */
async function connect(person, code, { state: forceState } = {}) {
  const { url } = await person.json("GET", "/api/integrations/gmail-oauth/start");
  const state = forceState ?? new URL(url).searchParams.get("state");
  const r = await person.call("GET", `/api/integrations/gmail-oauth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
  expect(r.status).toBe(302);
  return { landed: decodeURIComponent(r.headers.get("location")), url };
}
async function sendEmail(person, subject) {
  const e = await person.json("POST", "/api/emails", { toAddr: "friend@example.com", subject, html: `<p>${subject}</p>` });
  return person.call("POST", `/api/emails/${e.id}/send`, {});
}

describe("Connect with Google (Gmail)", () => {
  it("asks Google for permission to send only, offline, back to this app", async () => {
    const { url } = await bob.json("GET", "/api/integrations/gmail-oauth/start");
    const q = new URL(url).searchParams;
    expect(q.get("client_id")).toBe("client-1");
    expect(q.get("redirect_uri")).toBe("http://localhost:5999/api/integrations/gmail-oauth/callback");
    expect(q.get("scope").split(" ")).toEqual(["openid", "email", "https://www.googleapis.com/auth/gmail.send"]);
    expect(q.get("access_type")).toBe("offline");
  });

  it("refuses a way back that isn't genuine, isn't yours, or was cancelled", async () => {
    // tampered
    expect((await connect(bob, "code-bob@gmail.com", { state: "abc.def" })).landed).toBe("/backup?connect-error=That link isn't from Hyperfocus.");
    // Bob's link opened by Alice
    const { url } = await bob.json("GET", "/api/integrations/gmail-oauth/start");
    const bobsState = new URL(url).searchParams.get("state");
    expect((await connect(alice, "code-alice@gmail.com", { state: bobsState })).landed).toBe("/backup?connect-error=This was started by someone else.");
    // cancelled at Google
    const r = await bob.call("GET", "/api/integrations/gmail-oauth/callback?error=access_denied");
    expect(decodeURIComponent(r.headers.get("location"))).toBe("/backup?connect-error=You didn't allow it, so nothing changed.");
    // a bad code
    expect((await connect(bob, "nonsense")).landed).toBe("/backup?connect-error=That code is no good.");
    expect(await bob.json("GET", "/api/integrations")).toEqual([]);
  });

  it("two people each send from their own Gmail, signed in with their own token (renewed when expired)", async () => {
    expect((await connect(bob, "code-bob@gmail.com")).landed).toBe("/backup?connected=gmail");
    expect((await connect(alice, "code-short-alice@gmail.com")).landed).toBe("/backup?connected=gmail");
    expect(await bob.json("GET", "/api/integrations")).toEqual([expect.objectContaining({ provider: "gmail-oauth", account: "bob@gmail.com" })]);
    expect(await bob.json("GET", "/api/emails/status")).toMatchObject({ ready: true, user: "bob@gmail.com" });
    expect((await alice.json("GET", "/api/me")).connected.email).toBe(true);

    expect((await sendEmail(bob, "From Bob")).status).toBe(200);
    expect((await sendEmail(alice, "From Alice")).status).toBe(200);
    const bobs = smtp.mails.find((m) => m.raw.includes("From Bob"));
    const alices = smtp.mails.find((m) => m.raw.includes("From Alice"));
    expect(bobs.login).toBe("bob@gmail.com");
    expect(bobs.raw).toMatch(/^From: bob@gmail\.com/m);
    expect(alices.login).toBe("alice@gmail.com");
    expect(alices.raw).toMatch(/^From: alice@gmail\.com/m);
    // Alice's token had expired: it was renewed with her refresh token first
    expect(smtp.logins).toContainEqual({ user: "alice@gmail.com", token: "renewed-refresh-alice@gmail.com" });
    expect(fakeGoogle.requests).toContainEqual(expect.objectContaining({ grant_type: "refresh_token", refresh_token: "refresh-alice@gmail.com" }));
    // nobody's token was ever used for someone else
    for (const l of smtp.logins) expect(l.token).toContain(l.user);
  });

  it("disconnecting stops sending", async () => {
    expect((await bob.call("DELETE", "/api/integrations/gmail-oauth")).status).toBe(200);
    expect((await bob.json("GET", "/api/emails/status")).ready).toBe(false);
    expect((await sendEmail(bob, "After disconnecting")).status).toBe(400);
  });
});
