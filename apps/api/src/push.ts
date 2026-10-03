import fs from "node:fs";
import webpush from "web-push";
import type { Channel } from "./notifications.ts";
import type { Db } from "./types.ts";

// Web push (P5-11): notifications on your phone or computer even when Hyperfocus isn't open. Each device you switch it
// on for is a PushSubscription. The app signs what it sends with its VAPID keys (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY;
// make them with `pnpm push:keys`). Local mode without them: a pair is made once and kept in apps/api/vapid.json.

export type Vapid = { publicKey: string; privateKey: string; subject: string };

/** The VAPID keys from the settings, or (local mode) from a file made the first time. Null = push is off. */
export function vapidFrom(cfg: { publicKey: string; privateKey: string; subject: string }, localFile: string | null): Vapid | null {
  if (cfg.publicKey && cfg.privateKey) return cfg;
  if (!localFile) return null;
  if (!fs.existsSync(localFile)) {
    const keys = webpush.generateVAPIDKeys();
    fs.writeFileSync(localFile, JSON.stringify(keys), { mode: 0o600, flag: "wx" });
  }
  const { publicKey, privateKey } = JSON.parse(fs.readFileSync(localFile, "utf8")) as { publicKey: string; privateKey: string };
  return { publicKey, privateKey, subject: cfg.subject };
}

/** The push channel: the notification to each of the person's devices. A device that is gone (404/410) is forgotten. */
export function pushChannel(prisma: Db, vapid: Vapid): Channel {
  return async (note) => {
    const devices = await prisma.pushSubscription.findMany();
    const errors: string[] = [];
    for (const d of devices) {
      // web-push signs (VAPID) and encrypts (aes128gcm) the request; it is sent here, with a time limit
      const req = webpush.generateRequestDetails(
        { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
        JSON.stringify({ title: note.title, body: note.body, url: "/" }),
        { vapidDetails: vapid, TTL: 3600 },
      );
      try {
        const r = await fetch(req.endpoint, { method: req.method, headers: req.headers as Record<string, string>, body: req.body ?? null, signal: AbortSignal.timeout(10000) });
        if (r.status === 404 || r.status === 410) await prisma.pushSubscription.deleteMany({ where: { id: d.id } });
        else if (!r.ok) errors.push(`${new URL(d.endpoint).host}: ${r.status}`);
      } catch (e) {
        errors.push(`${new URL(d.endpoint).host}: ${(e as Error).message}`);
      }
    }
    return errors.length ? { ok: false, error: errors.join("; ") } : { ok: true };
  };
}
