import { PassThrough, Readable } from "node:stream";
import { Hono } from "hono";
import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { problemResponse } from "../../src/http/problem.ts";
import { honoFirst, routeOwner } from "../../src/http/strangler.ts";
import { httpError } from "../../src/types.ts";

// The Hono app (P2-01), tested in-process with app.request(): no server, no network.

const config = (over = {}) => ({
  databaseUrl: "file:./x.db", port: 4000, demo: false, notifyDryRun: true,
  deepseek: { apiKey: "k", url: "http://ai", model: "m" }, n8nWebhookUrl: "http://n8n", googleBooksApiKey: "",
  gmail: { user: "", appKey: "" }, settingsFile: "", backupDir: "", logLevel: "silent", ...over,
});
const lines = [];
const memoryLog = () => pino({ level: "info" }, { write: (l) => lines.push(JSON.parse(l)) });
const make = (over) => createApp({ config: config(over), prisma: {}, log: memoryLog() });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("health (served by Hono)", () => {
  it("answers like the Express route did", async () => {
    const r = await make().request("/api/health");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, ai: true, n8n: true, demo: false });
  });
  it("reports the demo and missing services from the config", async () => {
    const r = await make({ demo: true, deepseek: { apiKey: "", url: "", model: "" }, n8nWebhookUrl: "" }).request("/api/health");
    expect(await r.json()).toEqual({ ok: true, ai: false, n8n: false, demo: true });
  });
});

describe("request id and logging", () => {
  it("gives every response an X-Request-Id, and keeps one the caller sent", async () => {
    const app = make();
    expect((await app.request("/api/health")).headers.get("x-request-id")).toMatch(UUID);
    expect((await app.request("/api/health", { headers: { "X-Request-Id": "abc-123" } })).headers.get("x-request-id")).toBe("abc-123");
  });
  it("logs one structured line per request, with its id", async () => {
    lines.length = 0;
    await make().request("/api/health", { headers: { "X-Request-Id": "req-1" } });
    expect(lines).toEqual([expect.objectContaining({ msg: "request", requestId: "req-1", method: "GET", path: "/api/health", status: 200 })]);
    expect(lines[0].ms).toBeGreaterThanOrEqual(0);
  });
});

describe("errors as problem+json", () => {
  const app = new Hono();
  app.use(async (c, next) => { c.set("requestId", "r-9"); await next(); });
  app.onError((err, c) => problemResponse(c, err));
  app.get("/conflict", () => { throw httpError(409, "This post is already posted."); });
  app.get("/crash", () => { throw new Error("boom"); });

  it("keeps the status and message of an HttpError, and the `error` field the website reads", async () => {
    const r = await app.request("/conflict");
    expect(r.status).toBe(409);
    expect(r.headers.get("content-type")).toBe("application/problem+json");
    expect(await r.json()).toEqual({ type: "about:blank", title: "Conflict", status: 409, detail: "This post is already posted.", error: "This post is already posted.", requestId: "r-9" });
  });
  it("turns anything else into a 500", async () => {
    expect(await (await app.request("/crash")).json()).toMatchObject({ status: 500, title: "Internal Server Error", error: "boom" });
  });
});

describe("the strangler (Hono first, then Express)", () => {
  const owns = routeOwner(make());
  it("knows which routes Hono has (HEAD counts as GET), and leaves the rest to Express", () => {
    expect(owns("GET", "/api/health")).toBe(true);
    expect(owns("HEAD", "/api/health")).toBe(true);
    expect(owns("POST", "/api/health")).toBe(false);
    expect(owns("GET", "/api/tasks")).toBe(false);
    expect(owns("GET", "/api/health/extra")).toBe(false);
  });

  // a minimal Express-like request and response, so the middleware can run without a server
  const fakeReq = (method, url, body = "") => Object.assign(Readable.from(body ? [Buffer.from(body)] : []), { method, path: url.split("?")[0], originalUrl: url, headers: { host: "test", "x-request-id": "via-express" } });
  const fakeRes = () => {
    const res = new PassThrough();
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    Object.assign(res, { statusCode: 0, sent: {}, status(s) { res.statusCode = s; return res; }, setHeader(k, v) { res.sent[k] = v; } });
    res.done = new Promise((ok) => res.on("finish", () => ok(Buffer.concat(chunks).toString())));
    return res;
  };

  it("answers a Hono route through Express's request and response", async () => {
    const res = fakeRes();
    let passed = false;
    honoFirst(make())(fakeReq("GET", "/api/health"), res, () => { passed = true; });
    const body = await res.done;
    expect(passed).toBe(false);
    expect(res.statusCode).toBe(200);
    expect(res.sent["x-request-id"]).toBe("via-express");
    expect(JSON.parse(body)).toEqual({ ok: true, ai: true, n8n: true, demo: false });
  });

  it("passes other routes to Express without touching the body", async () => {
    const req = fakeReq("POST", "/api/tasks", '{"title":"x"}');
    let passed = false;
    honoFirst(make())(req, fakeRes(), () => { passed = true; });
    expect(passed).toBe(true);
    const chunks = [];
    for await (const c of req) chunks.push(c);
    expect(Buffer.concat(chunks).toString()).toBe('{"title":"x"}'); // still all there for express.json()
  });
});
