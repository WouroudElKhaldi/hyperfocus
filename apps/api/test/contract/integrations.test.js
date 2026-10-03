import { execFileSync } from "node:child_process";
import { OWNER_OMIT, PrismaClient } from "@hyperfocus/db";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { integrations, rotateSecrets } from "../../src/integrations.ts";
import { keyRing } from "../../src/secrets.ts";
import { asUser, tenancy } from "../../src/tenancy.ts";
import { del, get } from "../support/api.js";
import { TEST_SECRETS_KEYS } from "../support/stack.js";

// P5-07: each person's connected accounts, their tokens sealed in the database. Saved through the same store and guarded
// client the app uses (connecting comes with P5-08/P5-09), then looked at through the API and straight in the database.

const TOKEN = "ya29.a0-the-real-gmail-token";
let raw, db, ring;
const other = `integrations-other-${Date.now()}`;
beforeAll(async () => {
  raw = new PrismaClient({ datasourceUrl: inject("databaseUrl") });
  db = new PrismaClient({ datasourceUrl: inject("databaseUrl"), omit: OWNER_OMIT }).$extends(tenancy);
  ring = keyRing(TEST_SECRETS_KEYS);
  await raw.user.create({ data: { id: other, name: "Other", email: `${other}@example.com` } });
});
afterAll(async () => {
  await raw.user.delete({ where: { id: other } });
  await raw.$disconnect();
  await db.$disconnect();
});

describe("connected accounts", () => {
  it("keeps the tokens sealed: the database never shows them, the API never sends them", async () => {
    await asUser("owner", () => integrations(db, ring).save("gmail", "me@gmail.com", { access: TOKEN, refresh: "1//refresh" }));
    const [row] = await raw.integration.findMany({ where: { userId: "owner", provider: "gmail" } });
    expect(row.secret).not.toContain(TOKEN);
    expect(row.secret).not.toContain("refresh");
    expect(row.secret).toMatch(/^v1\.test\./);

    const list = await get("/api/integrations");
    expect(list.status).toBe(200);
    expect(list.body).toEqual([{ provider: "gmail", account: "me@gmail.com", connectedAt: expect.any(String), updatedAt: expect.any(String) }]);
    expect(JSON.stringify(list.body)).not.toContain(TOKEN);
    // and an export of your data leaves them out
    const exported = await fetch(`${inject("apiUrl")}/api/export`).then((r) => r.arrayBuffer());
    expect(Buffer.from(exported).includes(TOKEN)).toBe(false);
  });

  it("opens them only for their owner; reconnecting replaces them", async () => {
    expect(await asUser("owner", () => integrations(db, ring).read("gmail"))).toEqual({ account: "me@gmail.com", secret: { access: TOKEN, refresh: "1//refresh" } });
    expect(await asUser(other, () => integrations(db, ring).read("gmail"))).toBeNull();
    await asUser("owner", () => integrations(db, ring).save("gmail", "me@gmail.com", { access: "newer" }));
    expect((await asUser("owner", () => integrations(db, ring).read("gmail"))).secret).toEqual({ access: "newer" });
    expect(await raw.integration.count({ where: { userId: "owner", provider: "gmail" } })).toBe(1);
  });

  it("key rotation: every token is sealed again with the new key, and opens without the old one", async () => {
    await asUser(other, () => integrations(db, ring).save("linkedin", "Other", { access: "li-token" }));
    const fresh = `fresh:${Buffer.alloc(32, 9).toString("base64")}`;
    const both = keyRing(`${fresh},${TEST_SECRETS_KEYS}`);
    const ours = { userId: { in: ["owner", other] } };
    expect(await rotateSecrets(db, both)).toBeGreaterThanOrEqual(2);
    for (const r of await raw.integration.findMany({ where: ours })) expect(r.secret).toMatch(/^v1\.fresh\./);
    const onlyNew = keyRing(fresh);
    expect((await asUser(other, () => integrations(db, onlyNew).read("linkedin"))).secret).toEqual({ access: "li-token" });
    expect(await rotateSecrets(db, both)).toBe(0); // nothing left to do
    // back to the test key for the rest of the suite
    await rotateSecrets(db, keyRing(`${TEST_SECRETS_KEYS},${fresh}`));
  });

  it("disconnecting deletes the tokens", async () => {
    expect((await del("/api/integrations/gmail")).status).toBe(200);
    expect((await del("/api/integrations/gmail")).status).toBe(404);
    expect(await asUser("owner", () => integrations(db, ring).read("gmail"))).toBeNull();
  });

  it("pnpm secrets:new-key prints a key SECRETS_KEYS accepts", () => {
    const out = execFileSync(process.execPath, ["scripts/secrets.ts", "new-key"], { encoding: "utf8" }).trim();
    expect(keyRing(out).keys.size).toBe(1);
  });
});
