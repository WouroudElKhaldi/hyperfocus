import { OWNER_OMIT, PrismaClient } from "@hyperfocus/db";
import { afterAll, beforeAll, expect, inject, it } from "vitest";
import { saveSettings } from "../../src/notify.ts";
import { applyChatRetention } from "../../src/retention.ts";
import { asUser, tenancy } from "../../src/tenancy.ts";

// P5-12: AI chats are kept as long as each person chose. Pat chose 30 days: their older Talk messages and book questions
// go, an emptied old conversation goes, recent ones stay. Sam keeps everything: nothing of theirs is touched.

let raw, db;
const pat = `retention-pat-${Date.now()}`;
const sam = `retention-sam-${Date.now()}`;
const daysAgo = (n) => new Date(Date.now() - n * 24 * 3600_000);
beforeAll(async () => {
  raw = new PrismaClient({ datasourceUrl: inject("databaseUrl") });
  db = new PrismaClient({ datasourceUrl: inject("databaseUrl"), omit: OWNER_OMIT }).$extends(tenancy);
  for (const id of [pat, sam]) {
    await raw.user.create({ data: { id, name: id, email: `${id}@example.com` } });
    const old = await raw.chatThread.create({ data: { userId: id, title: "old", createdAt: daysAgo(60) } });
    const recent = await raw.chatThread.create({ data: { userId: id, title: "recent", createdAt: daysAgo(60) } });
    await raw.chatMessage.createMany({ data: [
      { userId: id, threadId: old.id, role: "user", content: "old question", createdAt: daysAgo(45) },
      { userId: id, threadId: recent.id, role: "user", content: "older part", createdAt: daysAgo(40) },
      { userId: id, threadId: recent.id, role: "user", content: "new question", createdAt: daysAgo(2) },
    ] });
    const book = await raw.book.create({ data: { userId: id, title: "A book" } });
    await raw.bookMessage.createMany({ data: [
      { userId: id, bookId: book.id, role: "user", content: "old book question", createdAt: daysAgo(31) },
      { userId: id, bookId: book.id, role: "user", content: "new book question", createdAt: daysAgo(1) },
    ] });
  }
  await asUser(pat, () => saveSettings(db, { chatKeepDays: 30 }));
});
afterAll(async () => {
  await raw.user.deleteMany({ where: { id: { in: [pat, sam] } } });
  await raw.$disconnect();
  await db.$disconnect();
});

it("deletes chats older than the person chose, and only theirs", async () => {
  expect(await asUser(pat, () => applyChatRetention(db))).toBe(4); // 2 messages, 1 book question, the emptied conversation
  const left = async (id) => ({
    chat: (await raw.chatMessage.findMany({ where: { userId: id }, orderBy: { id: "asc" } })).map((m) => m.content),
    threads: (await raw.chatThread.findMany({ where: { userId: id }, orderBy: { id: "asc" } })).map((t) => t.title),
    books: (await raw.bookMessage.findMany({ where: { userId: id }, orderBy: { id: "asc" } })).map((m) => m.content),
  });
  expect(await left(pat)).toEqual({ chat: ["new question"], threads: ["recent"], books: ["new book question"] });
  expect(await asUser(sam, () => applyChatRetention(db))).toBe(0); // keeps everything
  expect(await left(sam)).toEqual({ chat: ["old question", "older part", "new question"], threads: ["old", "recent"], books: ["old book question", "new book question"] });
});
