import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@hyperfocus/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { post } from "../support/api.js";
import { startExtraApi } from "../support/extra-api.js";
import { CLOUD, signUp } from "../support/people.js";

// P5-12: deleting your account removes it and everything in it, at once: every row it owns, its files in the file
// storage, its sessions. It needs DELETE typed and the password. Nobody else's data is touched.

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hf-delete-files-"));
let api, bob, alice, raw;
beforeAll(async () => {
  api = await startExtraApi("account_delete", { ...CLOUD, FILE_STORAGE: "disk", FILE_STORAGE_DIR: dir });
  raw = new PrismaClient({ datasourceUrl: api.dbUrl });
  [bob, alice] = await Promise.all([signUp(api, "bob-delete@example.com", "Bob"), signUp(api, "alice-delete@example.com", "Alice")]);
}, 120000);
afterAll(async () => {
  await raw?.$disconnect();
  await api?.stop();
});

// how many rows a person owns, over every table that has an owner
async function rowsOf(userId) {
  const tables = await raw.$queryRawUnsafe(`SELECT table_name FROM information_schema.columns WHERE table_schema = $1 AND column_name = 'userId'`, api.schema);
  let n = 0;
  for (const { table_name } of tables) n += (await raw.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${table_name}" WHERE "userId" = $1`, userId))[0].n;
  return n;
}
async function fillUp(person, word) {
  await person.json("POST", "/api/notes", { body: `${word} note` });
  await person.json("POST", "/api/tasks", { title: `${word} task` });
  await person.json("PATCH", "/api/settings", { breakEveryMin: 30 });
  const email = await person.json("POST", "/api/emails", { subject: word });
  const r = await person.call("POST", `/api/emails/${email.id}/attachments?name=${word}.txt`, Buffer.from(`${word} file`), true);
  expect(r.status).toBe(200);
}

describe("deleting your account", () => {
  it("doesn't exist in local mode", async () => {
    expect((await post("/api/account/delete", { confirm: "DELETE" })).status).toBe(404);
  });

  it("asks for DELETE and the right password", async () => {
    const say = async (b) => { const r = await bob.call("POST", "/api/account/delete", b); return [r.status, (await r.json()).error]; };
    expect(await say({ confirm: "delete", password: "pass-Bob-12345" })).toEqual([400, "Type DELETE to confirm."]);
    expect(await say({ confirm: "DELETE" })).toEqual([400, "Type your password to delete your account."]);
    expect(await say({ confirm: "DELETE", password: "wrong-password" })).toEqual([400, "That password isn't right."]);
  });

  it("removes the account, everything in it and its files; signs it out; leaves everyone else alone", async () => {
    await Promise.all([fillUp(bob, "bob"), fillUp(alice, "alice")]);
    const bobId = (await bob.json("GET", "/api/me")).user.id;
    const aliceId = (await alice.json("GET", "/api/me")).user.id;
    const filesBefore = fs.readdirSync(dir, { recursive: true }).filter((f) => fs.statSync(path.join(dir, f)).isFile()).length;
    expect(filesBefore).toBe(2);
    expect(await rowsOf(bobId)).toBeGreaterThan(5);
    const aliceRows = await rowsOf(aliceId);

    expect(await bob.json("POST", "/api/account/delete", { confirm: "DELETE", password: "pass-Bob-12345" })).toEqual({ ok: true });

    expect(await rowsOf(bobId)).toBe(0);
    expect(await raw.user.count({ where: { id: bobId } })).toBe(0);
    expect(await raw.session.count({ where: { userId: bobId } })).toBe(0);
    const filesAfter = fs.readdirSync(dir, { recursive: true }).filter((f) => fs.statSync(path.join(dir, f)).isFile());
    expect(filesAfter).toHaveLength(1); // only Alice's
    expect((await bob.json("GET", "/api/me")).user).toBeNull();
    expect((await bob.call("GET", "/api/notes")).status).toBe(401);
    // Alice: exactly as before
    expect(await rowsOf(aliceId)).toBe(aliceRows);
    expect(JSON.stringify(await alice.json("GET", "/api/notes"))).toContain("alice note");
    // and the address can be used for a new account
    expect((await signUp(api, "bob-delete@example.com", "Bob")).jar.size).toBeGreaterThan(0);
  });
});
