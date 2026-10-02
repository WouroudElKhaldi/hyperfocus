import { Note, NoteListItem } from "@hyperfocus/shared";
import { describe, expect, it } from "vitest";
import { del, get, ok, patch, post } from "../support/api.js";

describe("notes", () => {
  it("creates a note with defaults", async () => {
    const n = await ok(post("/api/notes", { body: "a passing thought" }));
    expect(n).toMatchObject({ id: expect.any(Number), kind: "thought", title: "", body: "a passing thought", pinned: false, archived: false });
  });

  it("rejects an empty note", async () => {
    const r = await post("/api/notes", { body: "   " });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("Write something first.");
  });

  it("lists notes pinned first, filters by kind, and shows post links", async () => {
    const a = await ok(post("/api/notes", { body: "idea A", kind: "post_idea" }));
    const b = await ok(post("/api/notes", { body: "idea B", kind: "post_idea" }));
    await ok(patch(`/api/notes/${a.id}`, { pinned: true }));
    const p = await ok(post("/api/posts", { thought: "from note", noteId: b.id }));

    const list = await ok(get("/api/notes?kind=post_idea"));
    expect(list.every((n) => n.kind === "post_idea")).toBe(true);
    expect(list[0].id).toBe(a.id);
    const nb = list.find((n) => n.id === b.id);
    expect(nb.postIds).toContain(p.id);
    expect(nb.posted).toBe(false);

    await ok(post(`/api/posts/${p.id}/mark-posted`));
    expect((await ok(get("/api/notes?kind=post_idea"))).find((n) => n.id === b.id).posted).toBe(true);
  });

  it("updates and archives a note", async () => {
    const n = await ok(post("/api/notes", { body: "x" }));
    const u = await ok(patch(`/api/notes/${n.id}`, { title: "T", body: "y", kind: "note", archived: true }));
    expect(u).toMatchObject({ title: "T", body: "y", kind: "note", archived: true });
  });

  it("every response matches the shared Note schemas (@hyperfocus/shared)", async () => {
    const n = await ok(post("/api/notes", { body: "schema note", kind: "project_idea" }));
    expect(Note.safeParse(n).error?.issues ?? []).toEqual([]);
    expect(Note.safeParse(await ok(patch(`/api/notes/${n.id}`, { pinned: true }))).error?.issues ?? []).toEqual([]);
    expect(NoteListItem.array().safeParse(await ok(get("/api/notes"))).error?.issues ?? []).toEqual([]);
  });

  it("deletes a note", async () => {
    const n = await ok(post("/api/notes", { body: "bye" }));
    expect(await ok(del(`/api/notes/${n.id}`))).toEqual({ ok: true });
    expect((await ok(get("/api/notes"))).some((x) => x.id === n.id)).toBe(false);
  });

  // Fixed in P2-06 (it used to be a 500): a missing or impossible id is "not found".
  it("answers 404 when updating or deleting a note that doesn't exist", async () => {
    for (const r of [await patch("/api/notes/999999", { title: "x" }), await del("/api/notes/999999"), await del("/api/notes/abc")]) {
      expect(r.status).toBe(404);
      expect(r.body.error).toBe("Note not found.");
    }
  });

  it("refuses a field of the wrong type with a 400 (it used to reach the database and fail with a 500)", async () => {
    const n = await ok(post("/api/notes", { body: "typed" }));
    expect((await patch(`/api/notes/${n.id}`, { pinned: "yes" })).status).toBe(400);
    expect((await post("/api/notes", { body: 42 })).status).toBe(400);
  });
});
