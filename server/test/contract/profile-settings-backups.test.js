import fs from "node:fs";
import path from "node:path";
import { describe, expect, inject, it } from "vitest";
import { api, get, ok, patch, post, put } from "../support/api.js";

describe("profile", () => {
  it("returns an empty profile before one is saved, then saves and trims fields", async () => {
    const p = await ok(get("/api/profile"));
    expect(p).toMatchObject({ name: expect.any(String), avatar: expect.stringMatching(/^#/) });
    const saved = await ok(put("/api/profile", { name: "  Ro  ", role: "Engineer", avatar: "#AABBCC", about: "x".repeat(700) }));
    expect(saved).toMatchObject({ name: "Ro", role: "Engineer", avatar: "#aabbcc" });
    expect(saved.about).toHaveLength(600);
    expect((await ok(get("/api/profile"))).name).toBe("Ro");
  });

  it("validates email, LinkedIn link and avatar colour", async () => {
    expect((await put("/api/profile", { email: "nope" })).body.error).toBe("That email doesn't look right.");
    expect((await put("/api/profile", { linkedin: "linkedin.com/in/x" })).body.error).toMatch(/https:\/\//);
    expect((await put("/api/profile", { avatar: "red" })).body.error).toBe("Pick a color for your avatar.");
  });
});

describe("settings & notifications", () => {
  it("reads defaults and saves clamped values (never exposing the internal 'sent' log)", async () => {
    const s = await ok(get("/api/settings"));
    expect(s).toMatchObject({ reminders: expect.any(Boolean), breakEveryMin: expect.any(Number), morningAt: expect.any(String) });
    expect(s.sent).toBeUndefined();
    const u = await ok(patch("/api/settings", { reminders: false, breakEveryMin: 5, morningAt: "07:30", sent: { hack: 1 } }));
    expect(u).toEqual({ reminders: false, breakEveryMin: 15, morningAt: "07:30" });
    expect((await ok(patch("/api/settings", { breakEveryMin: 999, morningAt: "25:00" })))).toMatchObject({ breakEveryMin: 180, morningAt: "07:30" });
  });

  it("sends a test notification (dry run in tests)", async () => {
    expect(await ok(post("/api/notify/test"))).toEqual({ ok: true });
  });
});

describe("backups", () => {
  it("creates a backup in the configured folder and lists it", async () => {
    const r = await ok(post("/api/backups"));
    expect(r.name).toMatch(/^thought-studio-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/);
    expect(path.resolve(r.folder)).toBe(path.resolve(inject("tmpDir"), "backups"));
    expect(fs.existsSync(path.join(r.folder, r.name))).toBe(true);
    expect((await ok(get("/api/backups"))).backups.some((b) => b.name === r.name)).toBe(true);
  });

  it("downloads a backup, and refuses names it did not create", async () => {
    const { name } = await ok(get("/api/backups")).then((b) => b.backups[0]);
    const d = await api("GET", `/api/backups/${name}/download`);
    expect(d.status).toBe(200);
    expect(d.headers.get("content-disposition")).toMatch(name);
    expect((await get("/api/backups/..%2F..%2Fsettings.json/download")).status).toBe(404);
    expect((await get("/api/backups/not-a-backup.db/download")).status).toBe(404);
  });
});
