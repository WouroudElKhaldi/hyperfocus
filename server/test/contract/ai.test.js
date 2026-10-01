import { afterEach, describe, expect, it } from "vitest";
import { fake, ok, post } from "../support/api.js";

describe("AI helpers", () => {
  afterEach(() => fake.reset("ai"));

  it("rewrites a thought into a post", async () => {
    expect((await post("/api/ai/rewrite", { thought: "" })).status).toBe(400);
    const r = await ok(post("/api/ai/rewrite", { thought: "Shipping small beats shipping perfect." }));
    expect(r).toEqual({ draft: expect.any(String), hookType: expect.any(String), hooks: expect.any(Array), suggestions: expect.any(Array) });
  });

  it("sends the configured key and model, and asks for JSON", async () => {
    await ok(post("/api/ai/rewrite", { thought: "x" }));
    const [req] = await fake.requests("ai");
    expect(req.headers.authorization).toBe("Bearer test-key");
    expect(req.body.response_format).toEqual({ type: "json_object" });
    expect(req.body.model).toEqual(expect.any(String));
  });

  it("edits a draft with an instruction, keeping the original thought in the prompt", async () => {
    await ok(post("/api/ai/rewrite", { thought: "ORIGINAL", draft: "current", instruction: "shorter" }));
    const [req] = await fake.requests("ai");
    expect(req.body.messages.at(-1).content).toMatch(/ORIGINAL[\s\S]*current[\s\S]*shorter/);
  });

  it("polishes text (accepting text or draft) and returns the changes", async () => {
    expect((await post("/api/ai/polish", {})).status).toBe(400);
    expect(await ok(post("/api/ai/polish", { text: "teh text" }))).toEqual({ draft: "teh text", changes: [] });
    expect(await ok(post("/api/ai/polish", { draft: "a draft" }))).toEqual({ draft: "a draft", changes: [] });
  });

  it("breaks a task into steps and organises a brain dump", async () => {
    expect(await ok(post("/api/ai/steps", { task: "clean room" }))).toEqual({ steps: expect.any(Array) });
    const o = await ok(post("/api/ai/organize", { text: "buy milk, post about testing" }));
    expect(o.items[0]).toMatchObject({ kind: expect.any(String), title: expect.any(String) });
  });

  it("suggests post ideas from study notes, needing enough notes", async () => {
    expect((await post("/api/ai/post-ideas", { notes: "short" })).status).toBe(400);
    const r = await ok(post("/api/ai/post-ideas", { course: "c", notes: "Today I learned how indexes work in Postgres." }));
    expect(r.ideas).toHaveLength(3);
    expect(r.ideas[0]).toEqual({ angle: expect.any(String), thought: expect.any(String) });
  });

  it("reports an AI provider failure as 502", async () => {
    await fake.failWith("ai", 500);
    const r = await post("/api/ai/rewrite", { thought: "x" });
    expect(r.status).toBe(502);
    expect(r.body.error).toMatch(/DeepSeek error 500/);
  });

  it("helps when stuck, using open tasks", async () => {
    await ok(post("/api/tasks", { title: "Stuck task", today: true }));
    const r = await ok(post("/api/stuck", { energy: "low", blocker: "too tired" }));
    expect(r).toEqual({ validation: expect.any(String), step: expect.any(String), ifStillStuck: expect.any(String), pick: expect.any(String) });
    const [req] = (await fake.requests("ai")).slice(-1);
    expect(req.body.messages.at(-1).content).toMatch(/Energy: low[\s\S]*Stuck task/);
  });
});
