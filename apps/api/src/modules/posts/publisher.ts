import { own, ownerAsking } from "../../credentials.ts";
import { errorInfo } from "../../types.ts";

// Where a finished post goes (P2-15): an outbound port, so LinkedIn through n8n today and the official "Share on LinkedIn"
// per user later (P5-09) are interchangeable. The rest of the posts module never knows which one it talks to.

/** `retry`: trying again later could work. A timeout is never retried, because the post may already be live. */
export type PublishResult = { ok: true } | { ok: false; retry: boolean; error: string };

export type SocialPublisher = {
  /** False when it isn't set up; the routes then answer with `notConfigured`. */
  configured(): boolean;
  publish(post: { id: number; draft: string }): Promise<PublishResult>;
};

/**
 * n8n with the person's own webhook (Settings → Connections). Otherwise the website's N8N_WEBHOOK_URL, for the owner
 * only (it may be their n8n on the same server, 127.0.0.1: set by them in .env, never by anyone else).
 * `checkOwn` (the hosted app): a person's own address is checked again right before sending (where its name points now).
 */
export function personalPublisher(fallbackUrl: string, { fetchImpl = fetch, checkOwn }: { fetchImpl?: typeof fetch; checkOwn?: (url: string) => Promise<boolean> } = {}): SocialPublisher {
  const url = () => own("n8n")?.webhookUrl ?? (ownerAsking() ? fallbackUrl : "");
  return {
    configured: () => !!url(),
    async publish(post) {
      const mine = own("n8n")?.webhookUrl;
      if (mine && checkOwn && !(await checkOwn(mine))) return { ok: false, retry: false, error: "Your n8n webhook address isn't a public https address any more. Change it in Settings → Your connections." };
      return n8nPublisher(url(), fetchImpl).publish(post);
    },
  };
}

/** Publishing through an n8n workflow (the webhook in N8N_WEBHOOK_URL), which posts to LinkedIn. */
export function n8nPublisher(webhookUrl: string, fetchImpl: typeof fetch = fetch): SocialPublisher {
  return {
    configured: () => !!webhookUrl,
    async publish(post) {
      if (!webhookUrl) return { ok: false, retry: false, error: "n8n_not_configured" };
      try {
        const r = await fetchImpl(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: post.id, text: post.draft }),
          signal: AbortSignal.timeout(30000),
        });
        if (r.ok) return { ok: true };
        return { ok: false, retry: true, error: `n8n answered ${r.status}. Is the workflow published, and is LinkedIn still connected?` };
      } catch (e) {
        // a timeout is ambiguous: LinkedIn may already have the post, so never retry automatically
        if (errorInfo(e).name === "TimeoutError") return { ok: false, retry: false, error: "n8n did not answer in time. Check your LinkedIn profile before trying again, it may have posted." };
        return { ok: false, retry: true, error: "Can't reach n8n. Is it running?" };
      }
    },
  };
}
