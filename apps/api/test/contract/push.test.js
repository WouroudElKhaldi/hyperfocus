import { createECDH, randomBytes } from "node:crypto";
import http from "node:http";
import { PrismaClient } from "@hyperfocus/db";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { get, ok, post } from "../support/api.js";
import { freePort } from "../support/stack.js";

// P5-11: web push. A stand-in push service (what Chrome/Firefox/Safari use) on this computer receives what the app sends:
// signed with the app's VAPID key, encrypted for the device. A device that is gone (410) is forgotten.

const received = [];
let pushService, base, raw;
const device = (path) => {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return { endpoint: `${base}/${path}`, keys: { p256dh: ecdh.getPublicKey("base64url"), auth: randomBytes(16).toString("base64url") } };
};
beforeAll(async () => {
  const port = await freePort();
  pushService = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      received.push({ url: req.url, headers: req.headers, size: Buffer.concat(chunks).length });
      res.writeHead(req.url.startsWith("/gone") ? 410 : 201);
      res.end();
    });
  });
  await new Promise((r) => pushService.listen(port, "127.0.0.1", r));
  base = `http://127.0.0.1:${port}`;
  raw = new PrismaClient({ datasourceUrl: inject("databaseUrl") });
});
afterAll(async () => {
  pushService?.close();
  await raw.pushSubscription.deleteMany({ where: { userId: "owner" } });
  await raw.$disconnect();
});

describe("web push", () => {
  it("gives browsers the app's public key", async () => {
    expect((await ok(get("/api/push/key"))).publicKey).toMatch(/^[A-Za-z0-9_-]{80,}$/);
  });

  it("accepts only a browser push service's address", async () => {
    for (const endpoint of ["https://evil.example/hook", "http://192.168.1.1/x", "https://localhost/x", "not a url"]) {
      const r = await post("/api/push/subscribe", { ...device("x"), endpoint });
      expect(r.status, endpoint).toBe(400);
    }
  });

  it("sends each notification to your devices, signed and encrypted; forgets a device that is gone", async () => {
    await ok(post("/api/push/subscribe", device("ok-1")));
    await ok(post("/api/push/subscribe", device("gone-1")));
    expect((await ok(get("/api/settings"))).push).toBe(true);
    expect(await raw.pushSubscription.count({ where: { userId: "owner" } })).toBe(2);

    await ok(post("/api/notify/test", {}));
    const toOk = received.filter((r) => r.url === "/ok-1");
    expect(toOk).toHaveLength(1);
    expect(toOk[0].headers.authorization).toMatch(/^vapid t=.+, k=.+/); // signed by the app
    expect(toOk[0].headers["content-encoding"]).toBe("aes128gcm"); // encrypted for that device
    expect(toOk[0].headers.ttl).toBe("3600");
    expect(toOk[0].size).toBeGreaterThan(50);
    expect(await raw.pushSubscription.findMany({ where: { userId: "owner" }, select: { endpoint: true } })).toEqual([{ endpoint: `${base}/ok-1` }]);
  });

  it("switching the last device off switches push off", async () => {
    await ok(post("/api/push/unsubscribe", { endpoint: `${base}/ok-1` }));
    expect((await ok(get("/api/settings"))).push).toBe(false);
    const before = received.length;
    await ok(post("/api/notify/test", {}));
    expect(received.length).toBe(before);
  });
});
