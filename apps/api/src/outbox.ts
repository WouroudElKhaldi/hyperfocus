import type { Db } from "./types.ts";

// The transactional outbox (P4-06). Anything that must reach the outside world because of a change (today: a desktop
// notification) is written as a row here *in the same transaction as the change*, so the change and its message are
// saved together or not at all. A background job (deliverOutbox, every few seconds) sends them. Each message has a key
// that is unique in the table, so the same message can never be written twice, from any copy of the API; a message that
// fails to send stays and is tried again, up to MAX_ATTEMPTS.

/** Anything that can write to the outbox: the client, or a transaction (`prisma.$transaction(async (tx) => …)`). */
type Writer = Pick<Db, "outboxMessage">;
/** One message as the sender sees it: for whom, which one, and what it says. */
export type OutboxNote = { userId: string; key: string; title: string; body: string };
export type Send = (note: OutboxNote) => Promise<{ ok: boolean; error?: string }>;

export const MAX_ATTEMPTS = 5;

/** Puts a notification in the outbox. Writing the same key again does nothing (it was already written once). */
export async function enqueue(db: Writer, key: string, title: string, body: string, kind = "notification"): Promise<void> {
  await db.outboxMessage.createMany({ data: [{ key, kind, title, body }], skipDuplicates: true });
}

/** Sends what is waiting, oldest first. Several copies may run this at once: each message is claimed before sending. */
export async function deliverOutbox(db: Pick<Db, "outboxMessage">, send: Send, { kind = "notification", limit = 20 } = {}): Promise<number> {
  // (the owner id is left out of every result, so it is asked for here: the sender needs to know whom it is for)
  const pending = await db.outboxMessage.findMany({ where: { kind, sentAt: null, attempts: { lt: MAX_ATTEMPTS } }, orderBy: { id: "asc" }, take: limit, omit: { userId: false } });
  let sent = 0;
  for (const m of pending) {
    // claim this attempt: only one copy gets count 1 for the same message and attempt number
    const claim = await db.outboxMessage.updateMany({ where: { id: m.id, sentAt: null, attempts: m.attempts }, data: { attempts: { increment: 1 } } });
    if (claim.count !== 1) continue;
    const r = await send({ userId: m.userId, key: m.key, title: m.title, body: m.body }).catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }));
    await db.outboxMessage.update({ where: { id: m.id }, data: r.ok ? { sentAt: new Date(), lastError: "" } : { lastError: r.error ?? "It couldn't be sent." } });
    if (r.ok) sent++;
    else console.error(`Notification "${m.title}" failed (try ${m.attempts + 1}/${MAX_ATTEMPTS}): ${r.error}`);
  }
  return sent;
}
