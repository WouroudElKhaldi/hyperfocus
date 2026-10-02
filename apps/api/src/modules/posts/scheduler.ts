import type { EventBus } from "../../events.ts";
import { remind } from "../../notify.ts";
import { type Db, errorInfo } from "../../types.ts";
import type { SocialPublisher } from "./publisher.ts";
import { MAX_ATTEMPTS, afterFailure, autoPostProblem, dueAction } from "./rules.ts";

// The scheduled-post sender (P2-15: moved from the Express file, behaviour unchanged). A background job (src/jobs) runs it
// every 30 seconds; the scheduler never runs it twice at once.

type Deps = { prisma: Db; publisher: SocialPublisher; events: EventBus };

/** On start-up: a post left "posting" means the app stopped while sending it. It may be live, so it's never re-sent. */
// Only posts stuck for over 5 minutes (a real send takes seconds): with several copies of the API (P4-05), one starting
// up must never fail a post another copy is sending right now.
const STUCK_MS = 5 * 60 * 1000;
export const failInterrupted = (prisma: Db, now = new Date()) =>
  prisma.post.updateMany({
    where: { status: "posting", OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lt: new Date(now.getTime() - STUCK_MS) } }] },
    data: { status: "failed", lastError: "The app stopped while this was being sent. Check your LinkedIn profile before posting it again, it may already be there." },
  });

export function postScheduler({ prisma, publisher, events }: Deps) {
  return async function runScheduler() {
    try {
      const now = new Date();
      const due = await prisma.post.findMany({ where: { status: "scheduled", scheduledAt: { lte: now } } });
      for (const p of due) {
        const action = dueAction(p, now);
        if (action === "missed") {
          await prisma.$transaction(async (tx) => {
            await tx.post.update({ where: { id: p.id }, data: { status: "missed", lastError: "The app wasn't running at the scheduled time, and it's been too long to post it automatically. Reschedule or post it yourself." } });
            await remind(tx, `missed:${p.id}`, "⚠️ A scheduled post wasn't sent", "The app was closed at the scheduled time. Open it to reschedule or post it yourself.");
          });
          continue;
        }
        if (action === "wait") continue;
        // claim it first so the same post can never be sent twice
        const claim = await prisma.post.updateMany({ where: { id: p.id, status: "scheduled" }, data: { status: "posting", lastAttemptAt: now } });
        if (claim.count !== 1) continue;
        if (autoPostProblem(p.draft)) {
          await prisma.$transaction(async (tx) => {
            await tx.post.update({ where: { id: p.id }, data: { status: "failed", lastError: "The draft changed after scheduling (empty, too long, or it now tags someone), so it wasn't auto-posted." } });
            await remind(tx, `changed:${p.id}`, "⚠️ A scheduled post wasn't sent", "The draft changed after scheduling. Open the post to check it.");
          });
          continue;
        }
        const r = await publisher.publish(p);
        if (r.ok) {
          await prisma.$transaction(async (tx) => {
            await tx.post.update({ where: { id: p.id }, data: { status: "posted", postedAt: new Date(), lastError: "" } });
            await remind(tx, `posted:${p.id}`, "🎉 Your post is live on LinkedIn", (p.draft.split("\n")[0] || "").slice(0, 100));
          });
          console.log(`Auto-posted post ${p.id}`);
          await events.publish("PostPublished", { postId: p.id });
        } else {
          const attempts = p.attempts + 1;
          const status = afterFailure(attempts, r.retry);
          await prisma.$transaction(async (tx) => {
            await tx.post.update({ where: { id: p.id }, data: { status, attempts, lastError: r.error } });
            if (status === "failed") await remind(tx, `failed:${p.id}:${attempts}`, "⚠️ Your scheduled post didn't go out", r.error.slice(0, 160));
          });
          console.error(`Auto-post ${p.id} failed (${attempts}/${MAX_ATTEMPTS}): ${r.error}`);
        }
      }
    } catch (e) {
      console.error("Scheduler error:", errorInfo(e).message);
    }
  };
}
