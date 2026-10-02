import { Hono } from "hono";
import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { API_HEADERS, bodyLimits, isAiRequest, rateLimit } from "../../src/http/security.ts";
import { allowedOrigin, createServer } from "../../src/server.ts";

// P2-23: rate limits, body size limits, API headers and CORS from the config. In-process, with a fake clock.

/** A tiny app behind the middleware, answering ok to anything. */
const behind = (mw) => {
  const app = new Hono();
  app.use(mw);
  app.all("*", (c) => c.text("ok"));
  return app;
};
const from = (address) => ({ incoming: { socket: { remoteAddress: address } } });

describe("rate limits", () => {
  it("allows the limit per minute, then answers 429 with Retry-After, and opens again after the minute", async () => {
    let t = 1_000_000;
    const app = behind(rateLimit({ perMinute: 3, aiPerMinute: 3, now: () => t }));
    for (let i = 0; i < 3; i++) expect((await app.request("/api/tasks")).status).toBe(200);
    const blocked = await app.request("/api/tasks");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("60");
    expect((await blocked.json()).error).toBe("Too many requests in one minute. Try again in a moment.");
    t += 45_000;
    expect((await app.request("/api/tasks")).headers.get("retry-after")).toBe("15");
    t += 15_000;
    expect((await app.request("/api/tasks")).status).toBe(200);
  });

  it("counts each visitor (connection address) separately", async () => {
    const app = behind(rateLimit({ perMinute: 1, aiPerMinute: 1, now: () => 0 }));
    expect((await app.request("/api/tasks", {}, from("10.0.0.1"))).status).toBe(200);
    expect((await app.request("/api/tasks", {}, from("10.0.0.1"))).status).toBe(429);
    expect((await app.request("/api/tasks", {}, from("10.0.0.2"))).status).toBe(200);
  });

  it("gives the routes that call the AI their own, smaller limit", async () => {
    const app = behind(rateLimit({ perMinute: 100, aiPerMinute: 2, now: () => 0 }));
    const ask = () => app.request("/api/ai/steps", { method: "POST" });
    expect((await ask()).status).toBe(200);
    expect((await ask()).status).toBe(200);
    const r = await ask();
    expect(r.status).toBe(429);
    expect((await r.json()).error).toMatch(/AI requests/);
    expect((await app.request("/api/tasks", { method: "POST" })).status).toBe(200); // other routes still work
  });

  it("knows which routes call the AI", () => {
    for (const p of ["/api/ai/rewrite", "/api/ai/polish-email", "/api/chat", "/api/stuck", "/api/skills/suggest", "/api/skills/3/plan", "/api/books/3/ask", "/api/books/3/find", "/api/goals/3/analyze", "/api/calendar/parse", "/api/calendar/plan", "/api/wins/summary", "/api/reviews"]) {
      expect(isAiRequest("POST", p), p).toBe(true);
    }
    for (const [m, p] of [["GET", "/api/reviews"], ["POST", "/api/tasks"], ["GET", "/api/chat/threads"], ["POST", "/api/chat/threads"], ["POST", "/api/books"]]) {
      expect(isAiRequest(m, p), `${m} ${p}`).toBe(false);
    }
  });
});

describe("body size limits", () => {
  const app = behind(bodyLimits());
  const send = (path, bytes, type = "application/json") => app.request(path, { method: "POST", body: "x".repeat(bytes), headers: { "Content-Type": type } });

  it("1 MB for a normal request, with a problem+json 413", async () => {
    expect((await send("/api/notes", 1024 * 1024)).status).toBe(200);
    const r = await send("/api/notes", 1024 * 1024 + 1);
    expect(r.status).toBe(413);
    expect((await r.json()).error).toBe("That request is too large (the limit is 1 MB).");
  });
  it("20 MB for a file sent to an email or template", async () => {
    expect((await send("/api/emails/4/attachments", 5 * 1024 * 1024, "application/octet-stream")).status).toBe(200);
    expect((await send("/api/email-templates/4/attachments", 5 * 1024 * 1024, "application/octet-stream")).status).toBe(200);
    expect((await send("/api/emails/4/attachments", 21 * 1024 * 1024, "application/octet-stream")).status).toBe(413);
  });
});

describe("API headers and CORS from the config", () => {
  const config = {
    databaseUrl: "file:./x.db", port: 4000, demo: false, notifyDryRun: true, deepseek: { apiKey: "", url: "", model: "" }, n8nWebhookUrl: "",
    googleBooksApiKey: "", bookSourcesUrl: "", gmail: { user: "", appKey: "" }, settingsFile: "", backupDir: "", logLevel: "silent",
    corsOrigins: [], rateLimit: { perMinute: 100, aiPerMinute: 100 },
  };
  const api = () => createApp({ config, prisma: {}, log: pino({ level: "silent" }) });

  it("every API answer is data, never a page: no sniffing, no framing, no referrer, no caching", async () => {
    const r = await api().request("/api/health");
    for (const [k, v] of Object.entries(API_HEADERS)) expect(r.headers.get(k), k).toBe(v);
    expect((await api().request("/api/nope-not-here")).headers.get("x-frame-options")).toBe("DENY");
  });
  it("the docs page keeps its own headers (it loads its viewer from a CDN)", async () => {
    expect((await api().request("/api/docs")).headers.get("x-frame-options")).toBeNull();
  });
  it("CORS: the CORS_ORIGINS list when set, otherwise pages on this computer", async () => {
    expect(allowedOrigin([])("http://localhost:5173")).toBe("http://localhost:5173");
    expect(allowedOrigin([])("https://app.example.com")).toBeNull();
    expect(allowedOrigin(["https://app.example.com"])("https://app.example.com")).toBe("https://app.example.com");
    expect(allowedOrigin(["https://app.example.com"])("http://localhost:5173")).toBeNull();
    const server = createServer(api(), { corsOrigins: ["https://app.example.com"] });
    const r = await server.request("/api/health", { headers: { Origin: "https://app.example.com" } });
    expect(r.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
  });
});
