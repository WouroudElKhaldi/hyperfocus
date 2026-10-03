import { AiError, type AiGateway } from "@hyperfocus/ai";
import { appAi, own } from "./credentials.ts";
import { currentUserId } from "./tenancy.ts";
import type { Db } from "./types.ts";

// AI daily limits (P5-10). When the owner shares their DeepSeek key (SHARE_AI_KEY), each person gets AI_DAILY_LIMIT requests a day on it
// (counted per person per UTC day in AiUsage; only answers that worked count). Someone who saved their own key
// (Settings → Connections) has no limit: they pay for it. 0 = no limit (the default in local mode).

export type AiUsage = { used: number; limit: number; ownKey: boolean; shared: boolean; resetsAt: string };

const today = (now = new Date()) => now.toISOString().slice(0, 10);
const tomorrow = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();

export function aiUsage(db: Db, limit: number) {
  return async (): Promise<AiUsage> => {
    const row = await db.aiUsage.findFirst({ where: { day: today() }, select: { requests: true } });
    return { used: row?.requests ?? 0, limit, ownKey: !!own("deepseek"), shared: appAi() === "shared", resetsAt: tomorrow() };
  };
}

/** The gateway with the daily limit in front of it. */
export function limitedAi(ai: AiGateway, db: Db, limit: number): AiGateway {
  const usage = aiUsage(db, limit);
  async function guarded<T>(call: () => Promise<T>): Promise<T> {
    const userId = currentUserId();
    // only the shared key is limited (SHARE_AI_KEY): your own key, and the owner on theirs, have no limit
    if (!limit || !userId || own("deepseek") || appAi() !== "shared") return call();
    const { used } = await usage();
    if (used >= limit) {
      throw new AiError(429, `You've used today's ${limit} AI requests. Come back tomorrow, or add your own DeepSeek key in Settings → Connections for no limit.`);
    }
    const out = await call();
    const day = today();
    await db.aiUsage.upsert({ where: { userId_day: { userId, day } }, create: { day, requests: 1 }, update: { requests: { increment: 1 } } });
    return out;
  }
  return {
    text: (messages, options) => guarded(() => ai.text(messages, options)),
    run: ((template: never, input: never) => guarded(() => ai.run(template, input))) as AiGateway["run"],
  };
}
