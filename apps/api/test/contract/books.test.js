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

  // The "find free copies" search calls Open Library, Google Books and Gutenberg on the internet,
  // so only the not-found path is covered here (a fake for those is part of P2-11).
  it("answers 404 when searching for a missing book", async () => {
    expect((await post("/api/books/999999/find")).status).toBe(404);
  });
});
