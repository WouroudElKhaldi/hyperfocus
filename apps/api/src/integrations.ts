import { type KeyRing, seal, sealedWith, unseal } from "./secrets.ts";
import { TenancyError, asSystem, currentUserId } from "./tenancy.ts";
import type { Db } from "./types.ts";

// Each person's connected accounts (P5-07): Gmail, LinkedIn … with their tokens sealed (src/secrets.ts). One per
// provider per person. The tokens are only ever opened here, by the code that uses them (P5-08 Gmail, P5-09 LinkedIn);
// no route sends them out.

// the credentials people paste in Settings (src/credentials.ts: deepseek, n8n, gmail) and the sign-in flows (P5-08, P5-09)
export const PROVIDERS = ["deepseek", "n8n", "gmail", "linkedin-app", "linkedin"] as const;
export type Provider = (typeof PROVIDERS)[number];

const context = (provider: string) => `integration:${provider}`;

export function integrations(db: Db, ring: KeyRing) {
  return {
    /** Connects (or reconnects) a provider for the person asking. `secret` is any JSON (tokens, expiry …). */
    async save(provider: Provider, account: string, secret: unknown) {
      const userId = currentUserId();
      if (!userId) throw new TenancyError("Connecting an account needs the person it belongs to.");
      const sealed = seal(ring, JSON.stringify(secret), context(provider));
      await db.integration.upsert({ where: { userId_provider: { userId, provider } }, create: { provider, account, secret: sealed }, update: { account, secret: sealed } });
    },
    /** The person's tokens for a provider, or null when it isn't connected. */
    async read<T = unknown>(provider: Provider): Promise<{ account: string; secret: T } | null> {
      const row = await db.integration.findFirst({ where: { provider } });
      return row ? { account: row.account, secret: JSON.parse(unseal(ring, row.secret, context(provider))) as T } : null;
    },
    /** Disconnects: the tokens are deleted. True when there was something to delete. */
    async remove(provider: string) {
      return (await db.integration.deleteMany({ where: { provider } })).count > 0;
    },
  };
}

/**
 * Key rotation: every secret not sealed with the current key is opened and sealed again with it. Everyone's rows, so it
 * runs as the system. Returns how many were sealed again.
 */
export function rotateSecrets(db: Db, ring: KeyRing): Promise<number> {
  return asSystem(async () => {
    let n = 0;
    for (const row of await db.integration.findMany({ select: { id: true, provider: true, secret: true } })) {
      if (sealedWith(row.secret) === ring.current) continue;
      const again = seal(ring, unseal(ring, row.secret, context(row.provider)), context(row.provider));
      await db.integration.update({ where: { id: row.id }, data: { secret: again } });
      n++;
    }
    return n;
  });
}
