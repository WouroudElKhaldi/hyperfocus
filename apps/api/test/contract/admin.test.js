import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { get, put } from "../support/api.js";
import { startExtraApi } from "../support/extra-api.js";
import { CLOUD, browser, signUp } from "../support/people.js";

// P5-06: roles. Everyone is a `user`; admins (the owner in local mode, ADMIN_EMAILS or someone an admin promoted in
// cloud mode) see the admin area: people, feature flags, connected services. Everyone else gets 403 there.

const ADMIN_ROUTES = [["GET", "/api/admin/providers"], ["GET", "/api/admin/users"], ["GET", "/api/admin/flags"], ["PUT", "/api/admin/flags/x", { enabled: true }], ["PATCH", "/api/admin/users/owner", { role: "user" }], ["GET", "/api/admin/job-sources"], ["POST", "/api/admin/job-sources", { kind: "lever", board: "x" }], ["PATCH", "/api/admin/job-sources/1", { enabled: false }]];

describe("roles in local mode", () => {
  it("the owner is the admin and sees the admin area", async () => {
    expect((await get("/api/me")).body.user.role).toBe("admin");
    const p = await get("/api/admin/providers");
    expect(p.status).toBe(200);
    expect(p.body).toMatchObject({ mode: "local", fileStorage: expect.any(String), people: expect.any(Number) });
  });

  it("a flag an admin switches on is listed for everyone in /api/me", async () => {
    expect((await put("/api/admin/flags/local-flag", { enabled: true, note: "test" })).body).toMatchObject({ key: "local-flag", enabled: true, note: "test" });
    expect((await get("/api/me")).body.flags).toContain("local-flag");
    await put("/api/admin/flags/local-flag", { enabled: false });
    expect((await get("/api/me")).body.flags).not.toContain("local-flag");
    expect((await put("/api/admin/flags/Not%20OK", { enabled: true })).status).toBe(400);
  });
});

describe("roles in cloud mode", () => {
  let api, boss, bob;
  beforeAll(async () => {
    api = await startExtraApi("roles", { ...CLOUD, ADMIN_EMAILS: " Boss@Example.com , other@example.com" });
    [boss, bob] = await Promise.all([signUp(api, "boss@example.com", "Boss"), signUp(api, "bob@example.com", "Bob")]);
  }, 120000);
  afterAll(async () => { await api?.stop(); });

  it("someone new is a user, and gets 403 everywhere in the admin area", async () => {
    expect((await bob.json("GET", "/api/me")).user.role).toBe("user");
    for (const [m, p, b] of ADMIN_ROUTES) expect((await bob.call(m, p, b)).status, `${m} ${p}`).toBe(403);
  });

  it("nobody can make themselves admin when signing up", async () => {
    const b = browser(() => api.url);
    await b.call("POST", "/api/auth/sign-up/email", { email: "sneaky@example.com", password: "sneaky-pass-123", name: "Sneaky", phone: "+961 70 123 456", role: "admin" });
    const people = await boss.json("GET", "/api/admin/users");
    expect(people.find((p) => p.email === "sneaky@example.com")?.role ?? "user").toBe("user");
  });

  it("an email in ADMIN_EMAILS is an admin (any capitals); signed out is 401, not 403", async () => {
    expect((await boss.json("GET", "/api/me")).user.role).toBe("admin");
    expect((await boss.call("GET", "/api/admin/providers")).status).toBe(200);
    expect((await browser(() => api.url).call("GET", "/api/admin/users")).status).toBe(401);
  });

  it("an admin can make someone an admin and back, but not take away their own role", async () => {
    const people = await boss.json("GET", "/api/admin/users");
    const bobId = people.find((p) => p.email === "bob@example.com").id;
    const bossId = people.find((p) => p.email === "boss@example.com").id;
    expect((await boss.json("PATCH", `/api/admin/users/${bobId}`, { role: "admin" })).role).toBe("admin");
    expect((await bob.call("GET", "/api/admin/flags")).status).toBe(200);
    expect((await bob.json("PATCH", `/api/admin/users/${bobId}`, { role: "admin" })).role).toBe("admin");
    expect((await boss.json("PATCH", `/api/admin/users/${bobId}`, { role: "user" })).role).toBe("user");
    expect((await bob.call("GET", "/api/admin/flags")).status).toBe(403);
    expect((await bob.call("PATCH", `/api/admin/users/${bobId}`, { role: "admin" })).status).toBe(403);
    expect((await boss.call("PATCH", "/api/admin/users/nobody", { role: "admin" })).status).toBe(404);
    // ADMIN_EMAILS people stay admin even if their stored role says user; someone stored as admin can't demote themselves
    expect((await boss.call("PATCH", `/api/admin/users/${bossId}`, { role: "user" })).status).toBe(400);
  });

  it("flags are shared: switched on by an admin, seen by everyone", async () => {
    await boss.json("PUT", "/api/admin/flags/job-radar", { enabled: true });
    expect((await bob.json("GET", "/api/me")).flags).toEqual(["job-radar"]);
  });
});
