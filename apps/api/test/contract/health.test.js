import { describe, expect, it } from "vitest";
import { get } from "../support/api.js";

describe("health", () => {
  it("reports the server is up and which integrations are configured", async () => {
    const r = await get("/api/health");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, ai: true, n8n: true, demo: false });
  });

  it("answers unknown API routes with 404", async () => {
    expect((await get("/api/does-not-exist")).status).toBe(404);
  });
});
