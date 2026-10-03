import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "@hono/zod-openapi";
import { type KeyRing, unseal } from "./secrets.ts";
import type { Db } from "./types.ts";
import type { GmailOAuthTokens } from "./google-oauth.ts";
import type { LinkedInTokens } from "./linkedin.ts";

// Your own credentials (P5-07, at your request): each person saves their DeepSeek key, their n8n LinkedIn webhook and
// their Gmail App Password in Settings → Connections. They are sealed in the Integration table (src/secrets.ts) and
// opened once per request (or per person in a background job), so the AI, posting and email use the person's own.
//
// Which credentials are used:
// - local mode: yours from Settings, otherwise the .env file (as before).
// - cloud mode: LinkedIn and Gmail are only ever the person's own (nobody posts or sends as someone else). The AI uses the
//   person's DeepSeek key, otherwise the app's own (with daily limits, P5-10).

export const CREDENTIALS = {
  deepseek: z.object({
    apiKey: z.string().trim().min(10, "Paste your DeepSeek API key (it starts with sk-).").max(300),
  }),
  n8n: z.object({
    webhookUrl: z.string().trim().url("Paste the full address of your n8n webhook (https://…).").max(500).refine((u) => /^https?:\/\//.test(u), "The webhook address must start with http:// or https://."),
  }),
  gmail: z.object({
    user: z.string().trim().email("Your full Gmail address, like you@gmail.com."),
    appKey: z.string().transform((s) => s.replace(/\s+/g, "")).pipe(z.string().regex(/^[a-z]{16}$/i, "A Gmail App Password is 16 letters (spaces don't matter).")),
  }),
};
export type CredentialKind = keyof typeof CREDENTIALS;
export const CREDENTIAL_KINDS = Object.keys(CREDENTIALS) as CredentialKind[];
export type Credentials = { [K in CredentialKind]?: z.infer<(typeof CREDENTIALS)[K]> } & {
  /** "Connect with Google" for Gmail (P5-08) */
  "gmail-oauth"?: GmailOAuthTokens;
  /** "Connect LinkedIn" (P5-09) */
  linkedin?: LinkedInTokens;
};
/** Everything opened per request: what people paste, and what the Google sign-in flow saves. */
const LOADED = [...CREDENTIAL_KINDS, "gmail-oauth", "linkedin"];

/** What the list shows for each (never the secret itself). */
export function describe(kind: CredentialKind, c: Credentials[CredentialKind]): string {
  if (kind === "deepseek") return `key ending in …${(c as Credentials["deepseek"])!.apiKey.slice(-4)}`;
  if (kind === "n8n") return new URL((c as Credentials["n8n"])!.webhookUrl).host;
  return (c as Credentials["gmail"])!.user;
}

export const sealContext = (provider: string) => `integration:${provider}`;

/**
 * May this person use the app's own DeepSeek key (DEEPSEEK_API_KEY)? "owner": yes (local mode, or an email in
 * ADMIN_EMAILS); "shared": yes, with the daily limit (only when SHARE_AI_KEY is on); "none": no, only their own key.
 * Off by default: nobody spends the owner's DeepSeek credit but the owner.
 */
export type AppAi = "owner" | "shared" | "none";
const store = new AsyncLocalStorage<{ creds: Credentials; appAi: AppAi }>();

/** Runs `fn` with the person's credentials opened (call inside asUser). A credential that can't be opened is skipped. */
export async function withCredentials<T>(db: Db, ring: KeyRing | null | undefined, fn: () => Promise<T>, appAi: AppAi = "none"): Promise<T> {
  const found: Credentials = {};
  if (ring) {
    const rows = await db.integration.findMany({ where: { provider: { in: LOADED } }, select: { provider: true, secret: true } });
    for (const r of rows) {
      try {
        (found as Record<string, unknown>)[r.provider] = JSON.parse(unseal(ring, r.secret, sealContext(r.provider)));
      } catch {
        // (a key that was removed too early: as if it wasn't saved; saving it again fixes it)
      }
    }
  }
  return store.run({ creds: found, appAi }, fn);
}

/** The person's own credentials for this kind, if they saved them. */
export const own = <K extends keyof Credentials>(kind: K): Credentials[K] | undefined => store.getStore()?.creds[kind];
/** Whether the person asking may use the app's own AI key, and how (see AppAi). */
export const appAi = (): AppAi => store.getStore()?.appAi ?? "none";
