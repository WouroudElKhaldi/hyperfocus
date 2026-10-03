import { getSettings } from "./notify.ts";
import type { Db } from "./types.ts";

// How long AI chats are kept (P5-12): each person chooses in Settings (30, 90 or 365 days, or keep them). Runs as one
// person (inside forEachUser): their Talk messages and book questions older than that are deleted, and a Talk
// conversation left with no messages goes too.

export async function applyChatRetention(prisma: Db, now = new Date()): Promise<number> {
  const { chatKeepDays } = await getSettings(prisma);
  if (!chatKeepDays) return 0;
  const before = new Date(now.getTime() - chatKeepDays * 24 * 3600_000);
  const [chat, books] = await Promise.all([
    prisma.chatMessage.deleteMany({ where: { createdAt: { lt: before } } }),
    prisma.bookMessage.deleteMany({ where: { createdAt: { lt: before } } }),
  ]);
  const threads = await prisma.chatThread.deleteMany({ where: { createdAt: { lt: before }, messages: { none: {} } } });
  return chat.count + books.count + threads.count;
}
