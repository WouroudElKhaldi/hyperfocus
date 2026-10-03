import { checkState as checkSigned, makeState } from "./oauth-state.ts";

// "Connect with Google" for Gmail (P5-08): each person lets the app send email from their own Gmail, without an App
// Password. Google's OAuth 2.0 web flow with the gmail.send scope only (the app can send, never read your mail).
// Uses the same Google Cloud OAuth client as "Sign in with Google" (GOOGLE_CLIENT_ID/SECRET); its authorised redirect
// URIs must include <PUBLIC_URL>/api/integrations/gmail-oauth/callback. GOOGLE_OAUTH_URL replaces Google only in tests.

export const GMAIL_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.send"];
export type GoogleOAuthSettings = { clientId: string; clientSecret: string; publicUrl: string; secret: string; baseUrl: string };
export type GmailOAuthTokens = { user: string; refreshToken: string; accessToken: string; expires: number };

const endpoints = (baseUrl: string) =>
  baseUrl ? { auth: `${baseUrl}/auth`, token: `${baseUrl}/token` } : { auth: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token" };
export const tokenUrl = (s: Pick<GoogleOAuthSettings, "baseUrl">) => endpoints(s.baseUrl).token;
export const redirectUri = (s: Pick<GoogleOAuthSettings, "publicUrl">) => `${s.publicUrl}/api/integrations/gmail-oauth/callback`;

/** Where to send the browser, and the nonce to keep in a cookie (see src/oauth-state.ts). */
export function startUrl(s: GoogleOAuthSettings, userId: string, now = Date.now()) {
  const { state, nonce } = makeState(s.secret, userId, now);
  const q = new URLSearchParams({
    client_id: s.clientId, redirect_uri: redirectUri(s), response_type: "code", scope: GMAIL_SCOPES.join(" "),
    access_type: "offline", prompt: "consent", include_granted_scopes: "true", state,
  });
  return { url: `${endpoints(s.baseUrl).auth}?${q}`, nonce };
}

/** Checks the state from the callback: signed by us, not expired, for this person, from this browser. */
export const checkState = (s: GoogleOAuthSettings, state: string, userId: string, cookieNonce: string | undefined, now = Date.now()) =>
  checkSigned(s.secret, state, userId, cookieNonce, now);

/** Trades the code Google sent back for tokens, and reads which Gmail address it is. */
export async function exchangeCode(s: GoogleOAuthSettings, code: string, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<GmailOAuthTokens> {
  const r = await fetchImpl(tokenUrl(s), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: s.clientId, client_secret: s.clientSecret, redirect_uri: redirectUri(s), grant_type: "authorization_code" }),
    signal: AbortSignal.timeout(15000),
  });
  const data = (await r.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; id_token?: string; scope?: string; error_description?: string };
  if (!r.ok || !data.access_token) throw new Error(data.error_description || `Google said no (${r.status}).`);
  if (!data.refresh_token) throw new Error("Google didn't give a lasting permission. Please try again (and allow access).");
  if (data.scope && !data.scope.split(" ").includes("https://www.googleapis.com/auth/gmail.send")) throw new Error("Sending email wasn't allowed. Please try again and tick \"Send email on your behalf\".");
  // the id token came straight from Google over HTTPS in answer to our own request: its email can be read as is
  const claims = JSON.parse(Buffer.from((data.id_token ?? "").split(".")[1] ?? "", "base64url").toString() || "{}") as { email?: string };
  if (!claims.email) throw new Error("Google didn't say which Gmail address this is.");
  return { user: claims.email, refreshToken: data.refresh_token, accessToken: data.access_token, expires: now + (data.expires_in ?? 3600) * 1000 };
}
