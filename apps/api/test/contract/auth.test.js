import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startExtraApi } from "../support/extra-api.js";

// P5-01: accounts in cloud mode (Better Auth): sign up, confirm the email, sign in and out, reset a forgotten password,
// and "Sign in with Google" when its keys are set. The emails go to the log in tests (MAIL_DRY_RUN), where the links are read.

const PUBLIC = "http://localhost:5999"; // the site's address (Better Auth checks that requests come from it)
let api, google;
beforeAll(async () => {
  const cloud = { APP_MODE: "cloud", BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-1234567890", PUBLIC_URL: PUBLIC, MAIL_DRY_RUN: "1" };
  [api, google] = await Promise.all([
    startExtraApi("auth", cloud),
    startExtraApi("auth_google", { ...cloud, GOOGLE_CLIENT_ID: "test-google-client.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "test-google-secret" }),
  ]);
}, 120000);
afterAll(async () => { await api?.stop(); await google?.stop(); });

// a tiny browser: keeps the cookies it is given, and says where it comes from
function browser(base = () => api.url) {
  const jar = new Map();
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const remember = (r) => {
    for (const c of r.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const v = pair.slice(i + 1);
      if (v) jar.set(pair.slice(0, i), v);
      else jar.delete(pair.slice(0, i));
    }
    return r;
  };
  const call = async (method, path, body) =>
    remember(await fetch(`${base()}${path}`, { method, redirect: "manual", headers: { Origin: PUBLIC, Cookie: cookie(), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }));
  return { call, open: (url) => call("GET", url.replace(PUBLIC, "").replace(/^https?:\/\/[^/]+/, "")), jar };
}
// the newest account email sent to this address, and the link in it
const mailTo = (to, subject) => {
  const lines = api.log().split("\n").filter((l) => l.startsWith(`[auth mail] to=${to} `) && l.includes(subject));
  const last = lines.at(-1);
  return last ? JSON.parse(last.slice(last.indexOf("text=") + 5)).match(/https?:\/\/\S+/)?.[0] : undefined;
};
const waitForMail = async (to, subject) => {
  for (const end = Date.now() + 10000; Date.now() < end; ) {
    const link = mailTo(to, subject);
    if (link) return link;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`No "${subject}" email to ${to}`);
};

describe("accounts (P5-01)", { timeout: 60000 }, () => {
  const email = "sam@example.com";

  it("signs up; signing in waits until the email is confirmed", async () => {
    const b = browser();
    const r = await b.call("POST", "/api/auth/sign-up/email", { email, password: "first-pass-123", name: "Sam" });
    expect(r.status, await r.clone().text()).toBe(200);
    const early = await b.call("POST", "/api/auth/sign-in/email", { email, password: "first-pass-123" });
    expect(early.status).toBe(403); // not confirmed yet
  });

  it("the confirmation link confirms the email and signs you in", async () => {
    const b = browser();
    const link = await waitForMail(email, "Confirm your email");
    const r = await b.open(link);
    expect([200, 302]).toContain(r.status);
    const s = await (await b.call("GET", "/api/auth/get-session")).json();
    expect(s.user).toMatchObject({ email, name: "Sam", emailVerified: true });
  });

  it("signs out, and in again with the password", async () => {
    const b = browser();
    expect((await b.call("POST", "/api/auth/sign-in/email", { email, password: "first-pass-123" })).status).toBe(200);
    expect((await (await b.call("GET", "/api/auth/get-session")).json())?.user?.email).toBe(email);
    expect((await b.call("POST", "/api/auth/sign-out", {})).status).toBe(200);
    expect(await (await b.call("GET", "/api/auth/get-session")).json()).toBeNull();
  });

  it("refuses a wrong password, and a password that is too short", async () => {
    const b = browser();
    expect((await b.call("POST", "/api/auth/sign-in/email", { email, password: "wrong-pass-999" })).status).toBe(401);
    expect((await b.call("POST", "/api/auth/sign-up/email", { email: "short@example.com", password: "123", name: "S" })).status).toBe(400);
  });

  it("resets a forgotten password with the emailed link; the old one stops working", async () => {
    const b = browser();
    expect((await b.call("POST", "/api/auth/request-password-reset", { email, redirectTo: `${PUBLIC}/reset-password` })).status).toBe(200);
    const link = await waitForMail(email, "Reset your Hyperfocus password");
    const token = new URL(link).pathname.split("/").at(-1);
    expect((await b.call("POST", "/api/auth/reset-password", { newPassword: "second-pass-456", token })).status).toBe(200);
    expect((await b.call("POST", "/api/auth/sign-in/email", { email, password: "first-pass-123" })).status).toBe(401);
    expect((await b.call("POST", "/api/auth/sign-in/email", { email, password: "second-pass-456" })).status).toBe(200);
    // the same link can't be used twice
    expect((await b.call("POST", "/api/auth/reset-password", { newPassword: "third-pass-789", token })).status).toBe(400);
  });

  it("refuses another website acting with your sign-in (cross-site request forgery)", async () => {
    const b = browser();
    expect((await b.call("POST", "/api/auth/sign-in/email", { email, password: "second-pass-456" })).status).toBe(200);
    const cookie = [...b.jar].map(([k, v]) => `${k}=${v}`).join("; ");
    // the same signed-in browser, but the request is made by a page on another site
    const r = await fetch(`${api.url}/api/auth/update-user`, { method: "POST", headers: { Origin: "https://evil.example", Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ name: "Hacked" }) });
    expect(r.status).toBe(403);
    expect((await (await b.call("GET", "/api/auth/get-session")).json()).user.name).toBe("Sam");
  });

  it("offers Google only when its keys are set, and sends you to Google with this app's id", async () => {
    const without = await browser().call("POST", "/api/auth/sign-in/social", { provider: "google", callbackURL: `${PUBLIC}/` });
    expect(without.status).not.toBe(200);
    const r = await browser(() => google.url).call("POST", "/api/auth/sign-in/social", { provider: "google", callbackURL: `${PUBLIC}/` });
    expect(r.status, await r.clone().text()).toBe(200);
    const { url } = await r.json();
    expect(url).toMatch(/^https:\/\/accounts\.google\.com\//);
    expect(new URL(url).searchParams.get("client_id")).toBe("test-google-client.apps.googleusercontent.com");
    expect(new URL(url).searchParams.get("redirect_uri")).toBe(`${PUBLIC}/api/auth/callback/google`);
  });
});
