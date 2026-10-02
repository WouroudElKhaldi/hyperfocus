import { afterEach, describe, expect, it } from "vitest";
import { del, fake, get, ok, patch, post } from "../support/api.js";

describe("support chat", () => {
  it("starts a new thread from the first message, titled from it", async () => {
    const r = await ok(post("/api/chat", { message: "I can't focus today at all" }));
    expect(r.user).toMatchObject({ role: "user", content: "I can't focus today at all" });
    expect(r.assistant).toMatchObject({ role: "assistant", content: "Fake companion reply." });
    expect(r.thread.title).toBe("I can't focus today at all");
    expect(r.crisis).toBe(false);
    const t = await ok(get(`/api/chat/threads/${r.thread.id}`));
    expect(t.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("continues an existing thread", async () => {
    const first = await ok(post("/api/chat", { message: "hello" }));
    await ok(post("/api/chat", { message: "again", threadId: first.thread.id }));
    expect((await ok(get(`/api/chat/threads/${first.thread.id}`))).messages).toHaveLength(4);
    expect((await post("/api/chat", { message: "x", threadId: 999999 })).status).toBe(404);
  });

  it("flags crisis messages so the app can show urgent help", async () => {
    const r = await ok(post("/api/chat", { message: "I want to die" }));
    expect(r.crisis).toBe(true);
  });

  it("temporary chats are answered but never saved", async () => {
    const before = (await ok(get("/api/chat/threads"))).length;
    const r = await ok(post("/api/chat", { message: "secret", temporary: true, history: [{ role: "user", content: "hi" }, { role: "system", content: "ignored" }] }));
    expect(r).toMatchObject({ temporary: true, crisis: false, assistant: { role: "assistant" } });
    expect((await ok(get("/api/chat/threads"))).length).toBe(before);
  });

  it("rejects empty messages", async () => {
    expect((await post("/api/chat", { message: "  " })).status).toBe(400);
  });

  it("creates, renames, lists and deletes threads", async () => {
    const t = await ok(post("/api/chat/threads"));
    expect((await ok(patch(`/api/chat/threads/${t.id}`, { title: "Renamed" }))).title).toBe("Renamed");
    expect((await patch(`/api/chat/threads/${t.id}`, { title: "" })).status).toBe(400);
    const row = (await ok(get("/api/chat/threads"))).find((x) => x.id === t.id);
    expect(row).toMatchObject({ title: "Renamed", count: 0 });
    await ok(del(`/api/chat/threads/${t.id}`));
    expect((await get(`/api/chat/threads/${t.id}`)).status).toBe(404);
  });

  it("deletes all threads", async () => {
    await ok(post("/api/chat", { message: "one more" }));
    await ok(del("/api/chat/threads"));
    expect(await ok(get("/api/chat/threads"))).toEqual([]);
  });
});

// P2-18: the crisis safeguard, explicitly. A message that sounds like she may hurt herself must always come back flagged
// (so the app shows urgent help) with a reply, never an error, also when the AI can't answer.
describe("support chat: crisis safeguard", () => {
  afterEach(() => fake.reset("ai"));

  it("sends the AI the instructions for this moment, including the lifeline", async () => {
    await ok(post("/api/chat", { message: "I don't want to be alive anymore" }));
    const [req] = (await fake.requests("ai")).slice(-1);
    expect(req.body.messages[0].content).toMatch(/hurting herself[\s\S]*1564/);
  });

  it("flags a temporary chat too", async () => {
    expect((await ok(post("/api/chat", { message: "I want to end my life", temporary: true }))).crisis).toBe(true);
  });

  it("when the AI is down, a crisis message still gets a safe reply (saved) and the flag", async () => {
    await fake.failWith("ai", 500);
    const r = await ok(post("/api/chat", { message: "I want to die" }));
    expect(r.crisis).toBe(true);
    expect(r.assistant.content).toMatch(/Are you safe right now\?[\s\S]*1564/);
    expect((await ok(get(`/api/chat/threads/${r.thread.id}`))).messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    const temp = await ok(post("/api/chat", { message: "I want to die", temporary: true }));
    expect(temp).toMatchObject({ crisis: true, assistant: { content: expect.stringMatching(/1564/) } });
  });

  it("when the AI is down, an ordinary message still gets the error (nothing is saved)", async () => {
    await fake.failWith("ai", 500);
    const before = (await ok(get("/api/chat/threads"))).length;
    const r = await post("/api/chat", { message: "can you explain recursion?" });
    expect(r.status).toBe(502);
    expect((await ok(get("/api/chat/threads"))).length).toBe(before);
  });
});

describe("support chat: 404s (P2-18)", () => {
  it("renaming or opening a chat that doesn't exist is a 404", async () => {
    for (const r of [await patch("/api/chat/threads/999999", { title: "x" }), await get("/api/chat/threads/abc")]) {
      expect(r.status).toBe(404);
      expect(r.body.error).toBe("That chat was not found.");
    }
  });
});
