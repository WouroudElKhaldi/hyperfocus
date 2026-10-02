import type { EventBus } from "../../events.ts";
import { remind } from "../../notify.ts";
import { type Db, errorInfo } from "../../types.ts";
import type { SocialPublisher } from "./publisher.ts";
import { MAX_ATTEMPTS, afterFailure, autoPostProblem, dueAction } from "./rules.ts";

// The scheduled-post sender (P2-15: moved from the Express file, behaviour unchanged). It runs every 30 seconds; P2-21
// puts it behind a scheduler interface and P4-05 on a job queue.

type Deps = { prisma: Db; publisher: SocialPublisher; events: EventBus };

/** On start-up: a post left "posting" means the app stopped while sending it. It may be live, so it's never re-sent. */
export const failInterrupted = (prisma: Db) =>
  prisma.post.updateMany({
    where: { status: "posting" },
    data: { status: "failed", lastError: "The app stopped while this was being sent. Check your LinkedIn profile before posting it again, it may already be there." },
  });

export function postScheduler({ prisma, publisher, events }: Deps) {
  let busy = false;
  return async function runScheduler() {
    if (busy) return;
    busy = true;
    try {
      const now = new Date();
      const due = await prisma.post.findMany({ where: { status: "scheduled", scheduledAt: { lte: now } } });
      for (const p of due) {
        const action = dueAction(p, now);
        if (action === "missed") {
          await prisma.post.update({ where: { id: p.id }, data: { status: "missed", lastError: "The app wasn't running at the scheduled time, and it's been too long to post it automatically. Reschedule or post it yourself." } });
          remind(`missed:${p.id}`, "⚠️ A scheduled post wasn't sent", "The app was closed at the scheduled time. Open it to reschedule or post it yourself.");
          continue;
        }
        if (action === "wait") continue;
        // claim it first so the same post can never be sent twice
        const claim = await prisma.post.updateMany({ where: { id: p.id, status: "scheduled" }, data: { status: "posting", lastAttemptAt: now } });
        if (claim.count !== 1) continue;
        if (autoPostProblem(p.draft)) {
          await prisma.post.update({ where: { id: p.id }, data: { status: "failed", lastError: "The draft changed after scheduling (empty, too long, or it now tags someone), so it wasn't auto-posted." } });
          remind(`changed:${p.id}`, "⚠️ A scheduled post wasn't sent", "The draft changed after scheduling. Open the post to check it.");
          continue;
        }
        const r = await publisher.publish(p);
        if (r.ok) {
          await prisma.post.update({ where: { id: p.id }, data: { status: "posted", postedAt: new Date(), lastError: "" } });
          console.log(`Auto-posted post ${p.id}`);
          await events.publish("PostPublished", { postId: p.id });
          remind(`posted:${p.id}`, "🎉 Your post is live on LinkedIn", (p.draft.split("\n")[0] || "").slice(0, 100));
        } else {
          const attempts = p.attempts + 1;
          const status = afterFailure(attempts, r.retry);
          await prisma.post.update({ where: { id: p.id }, data: { status, attempts, lastError: r.error } });
          console.error(`Auto-post ${p.id} failed (${attempts}/${MAX_ATTEMPTS}): ${r.error}`);
          if (status === "failed") remind(`failed:${p.id}:${attempts}`, "⚠️ Your scheduled post didn't go out", r.error.slice(0, 160));
        }
      }
    } catch (e) {
      console.error("Scheduler error:", errorInfo(e).message);
    } finally {
      busy = false;
    }
  };
}
