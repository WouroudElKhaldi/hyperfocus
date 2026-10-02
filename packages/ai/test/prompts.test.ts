import { describe, expect, it } from "vitest";
import { type AiProvider, createAiGateway, prompts } from "../src/index.ts";

// The templates read replies the way the API always did: missing text is "", missing lists are [], unknown choices
// fall back, and the few checks (a proofread that changed too much) still refuse.

const replying = (reply: unknown) => {
  const provider: AiProvider = { name: "fake", unavailable: () => null, complete: async () => (typeof reply === "string" ? reply : JSON.stringify(reply)) };
  return createAiGateway({ provider });
};

describe("prompt templates", () => {
  it("rewritePost: fills what's missing, and puts the original thought, draft and instruction in the prompt", async () => {
    expect(await replying({ draft: "D", hooks: ["a", 1] }).run(prompts.rewritePost, { thought: "T" })).toEqual({ draft: "D", hookType: "", hooks: ["a", "1"], suggestions: [] });
    const user = prompts.rewritePost.messages({ thought: "ORIGINAL", draft: "current", instruction: "shorter" }).at(-1)?.content;
    expect(user).toMatch(/ORIGINAL[\s\S]*current[\s\S]*shorter/);
    expect(prompts.rewritePost.messages({ thought: "x" })[0]?.content).toMatch(/TOP 10 HOOK PATTERNS/); // the playbook
  });

  it("polishDraft: refuses an empty answer or one that changed the length too much", async () => {
    expect(await replying({ draft: "the text", changes: ["teh -> the"] }).run(prompts.polishDraft, { draft: "teh text" })).toEqual({ draft: "the text", changes: ["teh -> the"] });
    await expect(replying({ draft: "" }).run(prompts.polishDraft, { draft: "teh text" })).rejects.toMatchObject({ status: 502, message: /changed too much/ });
    await expect(replying({ draft: "a much much longer text" }).run(prompts.polishDraft, { draft: "short" })).rejects.toMatchObject({ status: 502 });
    // a raw thought is allowed a bigger change when the caller says so
    expect((await replying({ draft: "abcdef" }).run(prompts.polishDraft, { draft: "abcd", maxDrift: 0.6 })).draft).toBe("abcdef");
  });

  it("analyzeGoal: an unknown verdict becomes 'stretch'", async () => {
    const input = { goal: "g", targetDate: undefined, today: "2026-10-02", studyHours14d: "1.0", existingActions: [] };
    expect((await replying({ verdict: "easy" }).run(prompts.analyzeGoal, input)).verdict).toBe("stretch");
    expect((await replying({ verdict: "unrealistic" }).run(prompts.analyzeGoal, input)).verdict).toBe("unrealistic");
  });

  it("postIdeas: at most 3, and only ideas with a thought", async () => {
    const ideas = [{ angle: "a", thought: "t1" }, { angle: "b" }, "junk", { thought: "t3" }, { thought: "t4" }];
    expect(await replying({ ideas }).run(prompts.postIdeas, { course: "", part: "", notes: "n" })).toEqual([{ angle: "a", thought: "t1" }]);
  });

  it("organize: unknown kinds become notes", async () => {
    const items = await replying({ items: [{ kind: "task", title: "Buy milk", body: "buy milk" }, { kind: "poem", title: "x" }] }).run(prompts.organize, { text: "..." });
    expect(items).toEqual([{ kind: "task", title: "Buy milk", body: "buy milk" }, { kind: "note", title: "x", body: "" }]);
  });

  it("suggestSkills and skillPlan: drop nameless items, default the area, keep at most 2 books", async () => {
    expect(await replying({ skills: [{ name: "APIs" }, { area: "x" }] }).run(prompts.suggestSkills, { context: "c", existing: [] })).toEqual([{ name: "APIs", area: "Other", why: "" }]);
    const books = [{ title: "A" }, { title: "" }, { title: "B", author: "b" }, { title: "C" }];
    expect(await replying({ steps: ["s"], books }).run(prompts.skillPlan, { name: "n", level: 1, target: 3 })).toEqual({ steps: ["s"], books: [{ title: "A", author: "" }, { title: "B", author: "b" }] });
  });

  it("writeReview: at most 3 priorities, each with a title", async () => {
    const priorities = [{ title: "a" }, { why: "no title" }, { title: "b" }, { title: "c" }, { title: "d" }];
    const r = await replying({ headline: "h", priorities }).run(prompts.writeReview, { facts: {} });
    expect(r.priorities.map((p) => p.title)).toEqual(["a", "b"]);
    expect(r).toMatchObject({ wins: [], watch: [], tinyStart: "", postIdea: "" });
  });

  it("matchBook: no list means 'keep every result' (null); ids are read as numbers", async () => {
    const input = { title: "t", author: "", candidates: [] };
    expect((await replying({ summary: "s" }).run(prompts.matchBook, input)).matchIds).toBeNull();
    expect((await replying({ matchIds: [0, "2"] }).run(prompts.matchBook, input)).matchIds).toEqual([0, 2]);
  });

  it("planStudy: minutes are rounded numbers; parseEvent reads allDay as a yes/no", async () => {
    const facts = { today: "2026-10-02", freeWindows: [], studyMinutesLast7Days: 0, goals: [], biggestSkillGaps: [], openTasks: [] };
    expect(await replying({ blocks: [{ day: "2026-10-03", start: "10:00", minutes: "44.6" }] }).run(prompts.planStudy, facts)).toEqual([
      { day: "2026-10-03", start: "10:00", minutes: 45, title: "", why: "" },
    ]);
    const parsed = await replying({ title: "Study", allDay: 1 }).run(prompts.parseEvent, { text: "x", today: "2026-10-02", weekday: "Friday", categories: [], repeats: [] });
    expect(parsed).toMatchObject({ title: "Study", allDay: true, day: "" });
  });

  it("polishEmail: a missing subject is null (hers is kept)", async () => {
    expect((await replying({ html: "<p>Hi</p>" }).run(prompts.polishEmail, { subject: "s", html: "<p>Hi</p>" })).subject).toBeNull();
  });

  it("companion and book chats keep only the recent history", () => {
    const history = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: String(i) }));
    expect(prompts.companionReply.messages({ history, message: "m", context: "c" })).toHaveLength(1 + 24 + 1);
    const book = { title: "B", author: "", status: "reading", notes: "" };
    const msgs = prompts.askAboutBook.messages({ book, knownSummary: "S", history, question: "q", helps: "" });
    expect(msgs).toHaveLength(1 + 16 + 1);
    expect(msgs[0]?.content).toMatch(/reading it now[\s\S]*may be wrong\): S/);
  });
});
