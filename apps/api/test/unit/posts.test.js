import { describe, expect, it } from "vitest";
import { n8nPublisher } from "../../src/modules/posts/publisher.ts";
import { CATCH_UP_MS, MAX_ATTEMPTS, RETRY_GAP_MS, afterFailure, autoPostProblem, dueAction } from "../../src/modules/posts/rules.ts";

// The rules for posting automatically and the n8n publisher (P2-15), without a clock, a database or a network.

describe("what can be auto-posted", () => {
  it("not an empty draft, not over 3000 characters, not one that tags someone", () => {
    expect(autoPostProblem("Hello LinkedIn")).toBeNull();
    expect(autoPostProblem("  \n ")).toBe("The draft is empty.");
    expect(autoPostProblem("x".repeat(3001))).toMatch(/3000 character/);
    expect(autoPostProblem("Thanks @Sami!")).toMatch(/tag someone/);
    expect(autoPostProblem("@Élodie was great")).toMatch(/tag someone/); // names in any alphabet
    expect(autoPostProblem("mail me at me@example.com")).toBeNull(); // an email address isn't a tag
  });
});

describe("the scheduler's decision for a due post", () => {
  const now = new Date("2026-10-02T12:00:00Z");
  const ago = (ms) => new Date(now.getTime() - ms);
  it("sends a post that just came due", () => {
    expect(dueAction({ scheduledAt: ago(60000), attempts: 0, lastAttemptAt: null }, now)).toBe("send");
  });
  it("marks as missed a post never tried that is over 2 hours late (the app was closed)", () => {
    expect(dueAction({ scheduledAt: ago(CATCH_UP_MS + 1), attempts: 0, lastAttemptAt: null }, now)).toBe("missed");
    expect(dueAction({ scheduledAt: ago(CATCH_UP_MS - 1), attempts: 0, lastAttemptAt: null }, now)).toBe("send");
  });
  it("waits 2 minutes between attempts, and a retry is never 'missed'", () => {
    expect(dueAction({ scheduledAt: ago(CATCH_UP_MS * 2), attempts: 1, lastAttemptAt: ago(RETRY_GAP_MS - 1) }, now)).toBe("wait");
    expect(dueAction({ scheduledAt: ago(CATCH_UP_MS * 2), attempts: 1, lastAttemptAt: ago(RETRY_GAP_MS) }, now)).toBe("send");
  });
  it("after a failure: tries again up to 3 times, never after an ambiguous failure", () => {
    expect(afterFailure(1, true)).toBe("scheduled");
    expect(afterFailure(MAX_ATTEMPTS, true)).toBe("failed");
    expect(afterFailure(1, false)).toBe("failed");
  });
});

describe("the n8n publisher", () => {
  const answering = (status) => async () => new Response("{}", { status });
  it("isn't configured without a webhook", async () => {
    const p = n8nPublisher("");
    expect(p.configured()).toBe(false);
    expect(await p.publish({ id: 1, draft: "x" })).toMatchObject({ ok: false, retry: false });
  });
  it("sends the post id and text, and reports n8n's failures as worth retrying", async () => {
    let sent;
    const ok = n8nPublisher("http://n8n/hook", async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return new Response("{}"); });
    expect(await ok.publish({ id: 7, draft: "Hello" })).toEqual({ ok: true });
    expect(sent).toEqual({ url: "http://n8n/hook", body: { postId: 7, text: "Hello" } });
    expect(await n8nPublisher("http://n8n/hook", answering(500)).publish({ id: 1, draft: "x" })).toMatchObject({ ok: false, retry: true, error: /n8n answered 500/ });
  });
  it("never retries a timeout (the post may already be live), but retries a refused connection", async () => {
    const timeout = n8nPublisher("http://n8n/hook", async () => { throw Object.assign(new Error("t"), { name: "TimeoutError" }); });
    expect(await timeout.publish({ id: 1, draft: "x" })).toMatchObject({ ok: false, retry: false, error: /may have posted/ });
    const down = n8nPublisher("http://n8n/hook", async () => { throw new TypeError("fetch failed"); });
    expect(await down.publish({ id: 1, draft: "x" })).toMatchObject({ ok: false, retry: true, error: "Can't reach n8n. Is it running?" });
  });
});
