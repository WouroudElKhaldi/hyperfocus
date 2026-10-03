import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// The safe way back from a sign-in page (Google P5-08, LinkedIn P5-09). The `state` sent along carries who started and
// when it expires (10 minutes), signed with the app's secret; the way back must also come from the same browser (a
// one-time nonce kept in a cookie), so nobody can attach their account to someone else's by sending them a link.

const sign = (secret: string, text: string) => createHmac("sha256", secret).update(text).digest("base64url");

/** A new state for `userId`, and the nonce to keep in the browser's cookie. */
export function makeState(secret: string, userId: string, now = Date.now()) {
  const nonce = randomBytes(16).toString("base64url");
  const body = Buffer.from(JSON.stringify({ u: userId, e: now + 10 * 60_000, n: nonce })).toString("base64url");
  return { state: `${body}.${sign(secret, body)}`, nonce };
}

/** What is wrong with the state that came back, or null when it is genuine, in time, this person's and this browser's. */
export function checkState(secret: string, state: string, userId: string, cookieNonce: string | undefined, now = Date.now()): string | null {
  const [body, mac] = state.split(".");
  if (!body || !mac) return "That link isn't from Hyperfocus.";
  const want = Buffer.from(sign(secret, body));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return "That link isn't from Hyperfocus.";
  const { u, e, n } = JSON.parse(Buffer.from(body, "base64url").toString()) as { u: string; e: number; n: string };
  if (e < now) return "That took too long. Please try connecting again.";
  if (u !== userId) return "This was started by someone else.";
  if (!cookieNonce || cookieNonce !== n) return "Please start connecting from this browser.";
  return null;
}
