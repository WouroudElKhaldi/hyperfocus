import { afterEach, describe, expect, it } from "vitest";
import { del, fake, get, ok, patch, post } from "../support/api.js";

const inMinutes = (m) => new Date(Date.now() + m * 60000).toISOString();
const draftPost = async (draft = "A finished draft.") => {
  const p = await ok(post("/api/posts", { thought: "my thought" }));
  return ok(patch(`/api/posts/${p.id}`, { draft }));
};

describe("posts", () => {
  afterEach(() => fake.reset("n8n"));

  it("creates, reads, updates, lists and deletes a post", async () => {
    const p = await ok(post("/api/posts", { thought: "t", draft: "d" }));
    expect(p).toMatchObject({ thought: "t", draft: "d", status: "draft", noteId: null });
    expect(await ok(get(`/api/posts/${p.id}`))).toMatchObject({ id: p.id });
    expect((await ok(patch(`/api/posts/${p.id}`, { draft: "d2" }))).draft).toBe("d2");
    expect((await ok(get("/api/posts"))).some((x) => x.id === p.id)).toBe(true);
    await ok(del(`/api/posts/${p.id}`));
    expect((await get(`/api/posts/${p.id}`)).status).toBe(404);
  });

  it("requires a thought", async () => {
    expect((await post("/api/posts", { thought: "" })).body.error).toBe("Write your thought first.");
  });

  it("publishes through n8n, sending the post id and text", async () => {
    const p = await draftPost("Hello LinkedIn");
    const r = await ok(post(`/api/posts/${p.id}/publish`));
    expect(r.status).toBe("posted");
    expect(r.postedAt).not.toBeNull();
    const sent = await fake.requests("n8n");
    expect(sent.at(-1).body).toEqual({ postId: p.id, text: "Hello LinkedIn" });
    expect((await post(`/api/posts/${p.id}/publish`)).status).toBe(409);
  });

  it("refuses to publish an empty draft and reports n8n failures as 502 without changing the post", async () => {
    const empty = await ok(post("/api/posts", { thought: "t" }));
    expect((await post(`/api/posts/${empty.id}/publish`)).status).toBe(400);
    const p = await draftPost();
    await fake.failWith("n8n", 500);
    const r = await post(`/api/posts/${p.id}/publish`);
    expect(r.status).toBe(502);
    expect(r.body.error).toMatch(/n8n answered 500/);
    expect((await ok(get(`/api/posts/${p.id}`))).status).toBe("draft");
  });

  it("marks a post as posted by hand", async () => {
    const p = await draftPost();
    expect((await ok(post(`/api/posts/${p.id}/mark-posted`))).status).toBe("posted");
  });

  it("schedules and unschedules a post", async () => {
    const p = await draftPost();
    const s = await ok(post(`/api/posts/${p.id}/schedule`, { scheduledAt: inMinutes(30) }));
    expect(s).toMatchObject({ status: "scheduled", attempts: 0 });
    const u = await ok(post(`/api/posts/${p.id}/unschedule`));
    expect(u).toMatchObject({ status: "draft", scheduledAt: null });
  });

  it("validates scheduling", async () => {
    const p = await draftPost();
    const err = async (body, id = p.id) => (await post(`/api/posts/${id}/schedule`, body)).body.error;
    expect(await err({ scheduledAt: "nope" })).toBe("Pick a valid date and time.");
    expect(await err({ scheduledAt: inMinutes(0) })).toBe("Pick a time at least a minute from now.");
    expect((await post("/api/posts/999999/schedule", { scheduledAt: inMinutes(30) })).status).toBe(404);
    const tagged = await draftPost("Thanks @Sami for this");
    expect(await err({ scheduledAt: inMinutes(30) }, tagged.id)).toMatch(/tag someone/);
    const long = await draftPost("x".repeat(3001));
    expect(await err({ scheduledAt: inMinutes(30) }, long.id)).toMatch(/3000 character/);
    const empty = await ok(post("/api/posts", { thought: "t" }));
    expect(await err({ scheduledAt: inMinutes(30) }, empty.id)).toBe("The draft is empty.");
  });

  // P2-15: a post that doesn't exist is a 404 everywhere (several of these used to be a 500, publishing said "The draft is empty.")
  it("answers 404 for a post that doesn't exist", async () => {
    for (const r of [
      await patch("/api/posts/999999", { draft: "x" }), await del("/api/posts/999999"), await post("/api/posts/999999/publish"),
      await post("/api/posts/999999/mark-posted"), await post("/api/posts/999999/unschedule"), await get("/api/posts/abc"),
    ]) {
      expect(r.status).toBe(404);
      expect(r.body.error).toBe("Post not found.");
    }
  });

  it("the AI helpers check their input", async () => {
    expect((await post("/api/ai/rewrite", { thought: 5 })).status).toBe(400);
    expect((await post("/api/ai/post-ideas", {})).body.error).toMatch(/a few more notes/);
  });
});
