import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppDeps, AppEnv } from "../../app.ts";
import { Ok, body, json, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { saveSettings } from "../../notify.ts";
import { httpError } from "../../types.ts";

// Web push on your devices (P5-11): the key a browser needs to subscribe, and switching a device on or off.

// Only the browsers' own push services: the server sends to this address, so it must never be one of our own machines.
const PUSH_HOSTS = [/\.googleapis\.com$/, /\.mozilla\.com$/, /\.mozaws\.net$/, /\.notify\.windows\.com$/, /\.push\.apple\.com$/];
const pushAddressOk = (u: string, allowLocal: boolean) => {
  try {
    const url = new URL(u);
    if (allowLocal && url.protocol === "http:" && url.hostname === "127.0.0.1") return true; // (tests: ALLOW_LOCAL_ADDRESSES)
    return url.protocol === "https:" && PUSH_HOSTS.some((h) => h.test(url.hostname));
  } catch {
    return false;
  }
};
const Subscription = z.object({
  endpoint: z.string().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

export function pushRouter({ prisma, vapid, config }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  app.openapi(
    createRoute({
      method: "get", path: "/api/push/key", tags: ["Notifications"], summary: "The public key a browser needs to switch push on",
      responses: { 200: json(z.object({ publicKey: z.string() }), "The key"), 409: problem("Push isn't set up for this app") },
    }),
    (c) => {
      if (!vapid) throw httpError(409, "Notifications on your devices aren't set up for this app yet.");
      return c.json({ publicKey: vapid.publicKey }, 200);
    },
  );
  app.openapi(
    createRoute({
      method: "post", path: "/api/push/subscribe", tags: ["Notifications"], summary: "Switch push on for this device",
      request: { body: body(Subscription) }, responses: { 200: json(Ok, "On"), 400: problem("Not a browser push address"), 409: problem("Push isn't set up for this app") },
    }),
    async (c) => {
      if (!vapid) throw httpError(409, "Notifications on your devices aren't set up for this app yet.");
      const { endpoint, keys } = c.req.valid("json");
      if (!pushAddressOk(endpoint, config.allowLocalAddresses)) throw httpError(400, "That isn't a browser push address.");
      const data = { p256dh: keys.p256dh, auth: keys.auth, userAgent: (c.req.header("user-agent") ?? "").slice(0, 200) };
      await prisma.pushSubscription.upsert({ where: { userId_endpoint: { userId: c.get("userId"), endpoint } }, create: { endpoint, ...data }, update: data });
      await saveSettings(prisma, { push: true });
      return c.json({ ok: true as const }, 200);
    },
  );
  app.openapi(
    createRoute({
      method: "post", path: "/api/push/unsubscribe", tags: ["Notifications"], summary: "Switch push off for this device",
      request: { body: body(z.object({ endpoint: z.string().max(1000) })) }, responses: { 200: json(Ok, "Off") },
    }),
    async (c) => {
      await prisma.pushSubscription.deleteMany({ where: { endpoint: c.req.valid("json").endpoint } });
      if (!(await prisma.pushSubscription.count())) await saveSettings(prisma, { push: false });
      return c.json({ ok: true as const }, 200);
    },
  );
  return app;
}
