import { own } from "./credentials.ts";
import type { PublishResult, SocialPublisher } from "./modules/posts/publisher.ts";
import { makeState } from "./oauth-state.ts";
import { errorInfo } from "./types.ts";

// "Connect LinkedIn" (P5-09): each person posts on their own LinkedIn through LinkedIn's official "Share on LinkedIn"
// product (scopes: openid, profile, w_member_social), with **their own LinkedIn app** (free, linkedin.com/developers):
// they save its Client ID and Secret in Settings, add <PUBLIC_URL>/api/integrations/linkedin/callback to it as an
// authorised redirect URL, and click Connect LinkedIn. Nothing of the website owner's is used. The access token lasts
// about 60 days; when it runs out, posting says to connect again. LINKEDIN_OAUTH_URL / LINKEDIN_API_URL replace
// LinkedIn only in tests.

export const LINKEDIN_SCOPES = ["openid", "profile", "w_member_social"];
export type LinkedInSettings = { clientId: string; clientSecret: string; publicUrl: string; secret: string; oauthUrl: string; apiUrl: string; version: string };
export type LinkedInTokens = { member: string; name: string; accessToken: string; expires: number };

const oauth = (s: LinkedInSettings) => s.oauthUrl || "https://www.linkedin.com/oauth/v2";
const apiBase = (s: Pick<LinkedInSettings, "apiUrl">) => s.apiUrl || "https://api.linkedin.com";
export const linkedinRedirect = (s: Pick<LinkedInSettings, "publicUrl">) => `${s.publicUrl}/api/integrations/linkedin/callback`;

/** Where to send the browser, and the nonce for this browser's cookie. */
export function linkedinStart(s: LinkedInSettings, userId: string) {
  const { state, nonce } = makeState(s.secret, userId);
  const q = new URLSearchParams({ response_type: "code", client_id: s.clientId, redirect_uri: linkedinRedirect(s), state, scope: LINKEDIN_SCOPES.join(" ") });
  return { url: `${oauth(s)}/authorization?${q}`, nonce };
}

/** Trades the code for a token, and reads who the member is. */
export async function linkedinExchange(s: LinkedInSettings, code: string, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<LinkedInTokens> {
  const r = await fetchImpl(`${oauth(s)}/accessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: linkedinRedirect(s), client_id: s.clientId, client_secret: s.clientSecret }),
    signal: AbortSignal.timeout(15000),
  });
  const t = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; scope?: string; error_description?: string };
  if (!r.ok || !t.access_token) throw new Error(t.error_description || `LinkedIn said no (${r.status}).`);
  if (t.scope && !t.scope.split(/[ ,]/).includes("w_member_social")) throw new Error("Posting wasn't allowed. Please try again and allow Hyperfocus to post for you.");
  const me = await fetchImpl(`${apiBase(s)}/v2/userinfo`, { headers: { Authorization: `Bearer ${t.access_token}` }, signal: AbortSignal.timeout(15000) });
  const info = (await me.json().catch(() => ({}))) as { sub?: string; name?: string };
  if (!me.ok || !info.sub) throw new Error("LinkedIn didn't say whose account this is.");
  return { member: info.sub, name: info.name ?? "", accessToken: t.access_token, expires: now + (t.expires_in ?? 60 * 86400) * 1000 };
}

/** Posts on the member's own feed (LinkedIn Posts API). */
export async function linkedinPost(s: Pick<LinkedInSettings, "apiUrl" | "version">, t: LinkedInTokens, text: string, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<PublishResult> {
  if (t.expires <= now) return { ok: false, retry: false, error: "Your LinkedIn connection ran out (they last about 60 days). Connect LinkedIn again in Settings → Your connections." };
  try {
    const r = await fetchImpl(`${apiBase(s)}/rest/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t.accessToken}`, "Content-Type": "application/json", "LinkedIn-Version": s.version, "X-Restli-Protocol-Version": "2.0.0" },
      body: JSON.stringify({
        author: `urn:li:person:${t.member}`, commentary: text, visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (r.ok) return { ok: true };
    if (r.status === 401) return { ok: false, retry: false, error: "LinkedIn didn't accept your connection any more. Connect LinkedIn again in Settings → Your connections." };
    if (r.status === 429 || r.status >= 500) return { ok: false, retry: true, error: `LinkedIn is busy (${r.status}). It will be tried again.` };
    return { ok: false, retry: false, error: `LinkedIn refused the post (${r.status}).` };
  } catch (e) {
    // a timeout is ambiguous: the post may be live, so never retried by itself
    if (errorInfo(e).name === "TimeoutError") return { ok: false, retry: false, error: "LinkedIn didn't answer in time. Check your profile before trying again, it may have posted." };
    return { ok: false, retry: true, error: "Can't reach LinkedIn right now." };
  }
}

/** The person's own LinkedIn first (P5-09), otherwise their n8n webhook / the fallback publisher. */
export function linkedinFirst(s: Pick<LinkedInSettings, "apiUrl" | "version">, otherwise: SocialPublisher, fetchImpl: typeof fetch = fetch): SocialPublisher {
  return {
    configured: () => !!own("linkedin") || otherwise.configured(),
    publish: (post) => {
      const t = own("linkedin");
      return t ? linkedinPost(s, t, post.draft, fetchImpl) : otherwise.publish(post);
    },
  };
}
