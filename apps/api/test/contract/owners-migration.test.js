import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@hyperfocus/db";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

// P5-02 acceptance: "migration reversible, counts preserved". On a database of its own: rows in many tables, then the
// owners migration is undone (migration.down.sql) and done again (migration.sql); no row is lost either way, and after
// it every row belongs to the owner account.

const DB_DIR = fileURLToPath(new URL("../../../../packages/db/", import.meta.url));
const MIGRATION = path.join(DB_DIR, "prisma/migrations/5_owners");
const url = new URL(inject("databaseUrl"));
url.searchParams.set("schema", `${url.searchParams.get("schema")}_owners`);
const prismaCli = (...args) => execFileSync(process.execPath, [path.join(DB_DIR, "node_modules/prisma/build/index.js"), ...args], { cwd: DB_DIR, env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe" });
const run = (file) => prismaCli("db", "execute", "--url", url.toString(), "--file", path.join(MIGRATION, file));

const TABLES = ["Note", "Task", "Step", "Goal", "GoalAction", "Win", "Pet", "PetXp", "Profile", "Reminder", "ChatThread", "ChatMessage"];
let db;
const counts = async () => Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, (await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${t}"`))[0].n])));
// (Integration, P5-07, was made after this migration, with its owner from the start)
const ownerColumns = async () => (await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = $1 AND column_name = 'userId' AND table_name NOT IN ('Session', 'Account', 'Integration')`, url.searchParams.get("schema")))[0].n;

beforeAll(async () => {
  prismaCli("migrate", "deploy");
  db = new PrismaClient({ datasourceUrl: url.toString() });
  const task = await db.task.create({ data: { userId: "owner", title: "t", steps: { create: [{ userId: "owner", text: "s1" }, { userId: "owner", text: "s2" }] } } });
  await db.note.createMany({ data: [{ userId: "owner", body: "n1" }, { userId: "owner", body: "n2" }, { userId: "owner", body: "n3" }] });
  const goal = await db.goal.create({ data: { userId: "owner", original: "g" } });
  await db.goalAction.create({ data: { userId: "owner", goalId: goal.id, text: "a" } });
  await db.win.create({ data: { userId: "owner", text: "w" } });
  await db.pet.create({ data: { userId: "owner", name: "Pip", species: "fox", color: "#fff" } });
  await db.petXp.createMany({ data: [{ userId: "owner", source: "task", key: `task:${task.id}`, amount: 4 }, { userId: "owner", source: "win", key: "win:1", amount: 4 }] });
  await db.profile.create({ data: { userId: "owner", name: "Sam" } });
  await db.reminder.create({ data: { userId: "owner", title: "r", at: new Date() } });
  const thread = await db.chatThread.create({ data: { userId: "owner", title: "c" } });
  await db.chatMessage.create({ data: { userId: "owner", threadId: thread.id, role: "user", content: "hi" } });
}, 120000);

afterAll(async () => {
  await db?.$disconnect();
  try { execFileSync(process.execPath, [path.join(DB_DIR, "node_modules/prisma/build/index.js"), "db", "execute", "--url", url.toString(), "--stdin"], { cwd: DB_DIR, input: `DROP SCHEMA IF EXISTS "${url.searchParams.get("schema")}" CASCADE;`, stdio: "pipe" }); } catch { /* gone */ }
});

describe("the owners migration (P5-02)", () => {
  it("gives all 24 kinds of data an owner, and every existing row belongs to the owner account", async () => {
    expect(await ownerColumns()).toBe(24);
    for (const t of TABLES) expect((await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${t}" WHERE "userId" <> 'owner'`))[0].n, t).toBe(0);
    expect(await db.user.findUnique({ where: { id: "owner" } })).toMatchObject({ email: "owner@localhost", emailVerified: true });
  });

  it("can be undone and done again, and no row is lost either way", async () => {
    const before = await counts();
    run("migration.down.sql");
    expect(await ownerColumns()).toBe(0);
    expect(await counts()).toEqual(before);
    run("migration.sql");
    expect(await ownerColumns()).toBe(24);
    expect(await counts()).toEqual(before);
    for (const t of TABLES) expect((await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${t}" WHERE "userId" <> 'owner'`))[0].n, t).toBe(0);
    // named after the profile when one exists
    expect((await db.user.findUnique({ where: { id: "owner" } })).name).toBe("Sam");
  });
});
