import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import { Hono } from "hono";
import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { problemResponse } from "../../src/http/problem.ts";
import { createServer } from "../../src/server.ts";
import { httpError } from "../../src/types.ts";

// The Hono app (P2-01), tested in-process with app.request(): no server, no network.

const config = (over = {}) => ({
  databaseUrl: "file:./x.db", port: 4000, demo: false, notifyDryRun: true,
  deepseek: { apiKey: "k", url: "http://ai", model: "m" }, n8nWebhookUrl: "http://n8n", googleBooksApiKey: "", bookSourcesUrl: "",
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

describe("demo mode (P2-20: a config flag)", () => {
  it("switches off backups, test notifications and email (P2-16: email too, now on Hono), and nothing else", async () => {
    const app = make({ demo: true });
    for (const [method, path] of [["GET", "/api/backups"], ["POST", "/api/backups"], ["GET", "/api/backups/x.db/download"], ["POST", "/api/notify/test"], ["GET", "/api/emails"], ["POST", "/api/emails/1/send"], ["GET", "/api/email-templates"]]) {
      const r = await app.request(path, { method });
      expect(r.status, `${method} ${path}`).toBe(403);
      expect((await r.json()).error).toBe("This is switched off in the demo.");
    }
    expect((await app.request("/api/health")).status).toBe(200);
  });
  it("leaves them on outside the demo", async () => {
    // (no database in this test, so reaching the route at all is what counts: it isn't the demo's 403)
    expect((await make().request("/api/backups/not-a-backup.db/download")).status).toBe(404);
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

describe("OpenAPI and docs (P2-02)", () => {
  it("serves an OpenAPI 3.1 document built from the route schemas", async () => {
    const doc = await (await make().request("/api/openapi.json")).json();
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.paths["/api/health"].get.responses["200"].content["application/json"].schema).toEqual({ $ref: "#/components/schemas/Health" });
    expect(Object.keys(doc.components.schemas.Health.properties)).toEqual(["ok", "ai", "n8n", "demo"]);
  });
  it("serves the documentation page", async () => {
    const r = await make().request("/api/docs");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/text\/html/);
    const html = await r.text();
    expect(html).toContain("Hyperfocus API");
    expect(html).toContain("/api/openapi.json");
  });
  it("answers a request that breaks a route's schema with a 400 problem carrying the schema's message", async () => {
    const app = make();
    const body = z.object({ title: z.string({ error: "Task needs a title." }).trim().min(1, "Task needs a title.") });
    const route = createRoute({ method: "post", path: "/api/example", request: { body: { content: { "application/json": { schema: body } } } }, responses: { 200: { description: "ok" } } });
    app.openapi(route, (c) => c.json({ title: c.req.valid("json").title }, 200));
    const send = (b) => app.request("/api/example", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
    expect(await (await send({ title: " hi " })).json()).toEqual({ title: "hi" });
    const bad = await send({});
    expect(bad.status).toBe(400);
    expect(bad.headers.get("content-type")).toBe("application/problem+json");
    expect(await bad.json()).toMatchObject({ status: 400, error: "Task needs a title." });
  });
});

describe("the HTTP server (P2-22: Hono only, Express is gone)", () => {
  it("lets pages on this computer call the API (CORS), and nobody else", async () => {
    const server = createServer(make());
    const local = await server.request("/api/health", { headers: { Origin: "http://localhost:5173" } });
    expect(local.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    const other = await server.request("/api/health", { headers: { Origin: "https://evil.example" } });
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
    const preflight = await server.request("/api/tasks", { method: "OPTIONS", headers: { Origin: "http://127.0.0.1:4000", "Access-Control-Request-Method": "PATCH" } });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-methods")).toMatch(/PATCH/);
  });

  it("answers an address the API doesn't have with a problem+json 404", async () => {
    const r = await createServer(make()).request("/api/nope", { method: "POST" });
    expect(r.status).toBe(404);
    expect(r.headers.get("content-type")).toMatch(/application\/problem\+json/);
    expect((await r.json()).error).toBe("There is no POST /api/nope in the API.");
  });

  it("in the demo, serves the website with its security headers, and index.html for the app's own addresses", async () => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), "hf-dist-"));
    try {
      fs.writeFileSync(path.join(dist, "index.html"), "<!doctype html><title>Hyperfocus</title>");
      fs.mkdirSync(path.join(dist, "assets"));
      fs.writeFileSync(path.join(dist, "assets", "app.js"), "console.log(1)");
      const server = createServer(make({ demo: true }), { demo: true, webDist: dist });
      const js = await server.request("/assets/app.js");
      expect(js.status).toBe(200);
      expect(await js.text()).toBe("console.log(1)");
      expect(js.headers.get("content-security-policy")).toMatch(/default-src 'self'/);
      const page = await server.request("/tasks/12"); // a website address: the single-page app takes it from here
      expect(page.status).toBe(200);
      expect(await page.text()).toMatch(/<title>Hyperfocus/);
      expect(page.headers.get("x-content-type-options")).toBe("nosniff");
      expect((await server.request("/api/health")).status).toBe(200);
      expect((await server.request("/api/nope")).status).toBe(404); // never index.html for an API address
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });

  it("outside the demo, serves only the API", async () => {
    expect((await createServer(make(), { demo: false, webDist: "/does/not/matter" }).request("/tasks")).status).toBe(404);
  });
});
