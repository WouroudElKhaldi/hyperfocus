import { describe, expect, it } from "vitest";
import { api, get } from "../support/api.js";

describe("health", () => {
  it("reports the server is up and which integrations are configured", async () => {
    const r = await get("/api/health");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, ai: true, n8n: true, demo: false });
  });

  it("says which request it was (X-Request-Id), and keeps the caller's id", async () => {
    expect((await get("/api/health")).headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect((await api("GET", "/api/health", undefined, { headers: { "X-Request-Id": "contract-1" } })).headers.get("x-request-id")).toBe("contract-1");
  });

  it("publishes an OpenAPI 3.1 document of the routes served by the new app", async () => {
    const r = await get("/api/openapi.json");
    expect(r.status).toBe(200);
    expect(r.body.openapi).toBe("3.1.0");
    expect(r.body.info.title).toBe("Hyperfocus API");
    expect(Object.keys(r.body.paths)).toContain("/api/health");
  });

  it("shows the API documentation page", async () => {
    const r = await get("/api/docs");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/text\/html/);
    expect(r.body).toContain("Hyperfocus API");
  });

  it("answers unknown API routes with 404", async () => {
    expect((await get("/api/does-not-exist")).status).toBe(404);
  });
});
