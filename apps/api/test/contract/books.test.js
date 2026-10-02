import { describe, expect, it } from "vitest";
import { del, get, ok, patch, post } from "../support/api.js";

describe("books", () => {
  it("adds a book (trimmed) and validates the title", async () => {
    expect((await post("/api/books", { title: "" })).body.error).toBe("Write the book's title.");
    const b = await ok(post("/api/books", { title: "  Clean Code ", author: " Robert C. Martin " }));
    expect(b).toMatchObject({ title: "Clean Code", author: "Robert C. Martin", status: expect.any(String) });
  });

  it("gets, updates status and notes, lists and deletes", async () => {
    const b = await ok(post("/api/books", { title: "Refactoring" }));
    expect(await ok(get(`/api/books/${b.id}`))).toMatchObject({ id: b.id });
    expect(await ok(patch(`/api/books/${b.id}`, { status: "done", notes: "great" }))).toMatchObject({ status: "done", notes: "great" });
    expect((await ok(get("/api/books"))).some((x) => x.id === b.id)).toBe(true);
    await ok(del(`/api/books/${b.id}`));
    expect((await get(`/api/books/${b.id}`)).status).toBe(404);
  });

  it("asks the AI about a book, keeps the conversation, and clears it", async () => {
    const b = await ok(post("/api/books", { title: "Atomic Habits" }));
    expect((await post(`/api/books/${b.id}/ask`, { question: "" })).status).toBe(400);
    expect((await post("/api/books/999999/ask", { question: "x" })).status).toBe(404);
    const r = await ok(post(`/api/books/${b.id}/ask`, { question: "What is the main idea?" }));
    expect(r.user).toMatchObject({ role: "user", content: "What is the main idea?" });
    expect(r.assistant).toMatchObject({ role: "assistant", content: "Fake companion reply." });
    expect(await ok(get(`/api/books/${b.id}/chat`))).toHaveLength(2);
    await ok(del(`/api/books/${b.id}/chat`));
    expect(await ok(get(`/api/books/${b.id}/chat`))).toEqual([]);
  });

  // "Find free copies" searches Open Library, Google Books and Gutenberg; in tests they are one local fake
  // (BOOK_SOURCES_URL, test/support/fakes.js), so nothing reaches the internet.
  it("answers 404 when searching for a missing book", async () => {
    expect((await post("/api/books/999999/find")).status).toBe(404);
  });

  it("finds copies: links from the sites only, best kinds first, saved on the book with the author filled in", async () => {
    const b = await ok(post("/api/books", { title: "Clean Code" }));
    const found = await ok(post(`/api/books/${b.id}/find`));
    expect(found.foundAt).toEqual(expect.any(String));
    const result = JSON.parse(found.result);
    expect(result.sourcesFailed).toEqual([]);
    expect(result.links.map((l) => [l.kind, l.source])).toEqual([
      ["borrow", "Open Library"], ["buy", "Google Books"], ["info", "Open Library"],
    ]);
    expect(result.links[0]).toMatchObject({ url: "https://archive.org/details/cleancode00mart", matched: "Clean Code - Robert C. Martin" });
    expect(result.links[1].label).toBe("Buy (30 USD) on Google Play Books");
    expect(result).toMatchObject({ summary: "Fake summary.", more: expect.any(Array), aiNote: "" });
  });

  // P2-11: a book that doesn't exist is a 404 (changing or deleting one used to be a 500)
  it("answers 404 for changing or deleting a book that doesn't exist, and 400 for a wrongly typed field", async () => {
    for (const r of [await patch("/api/books/999999", { notes: "x" }), await del("/api/books/999999"), await get("/api/books/abc")]) {
      expect(r.status).toBe(404);
      expect(r.body.error).toBe("That book was not found.");
    }
    expect((await post("/api/books", { title: "x", author: 5 })).status).toBe(400);
  });
});
