import { describe, expect, it } from "vitest";
import { get, post } from "../support/api.js";

// P5-13: local mode (the default, APP_MODE=local) is how you use the app today: the owner is signed in by itself,
// nobody can make an account or sign in, and everything works without a cookie.

describe("local mode", () => {
  it("says it is local and that the owner is the one using it", async () => {
    const r = await get("/api/me");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ mode: "local", google: false, user: { id: "owner" } });
  });

  it("has no sign-up or sign-in: the account routes don't exist", async () => {
    expect((await post("/api/auth/sign-up/email", { email: "x@example.com", password: "long-enough-123", name: "X Y", phone: "+961 70 123 456" })).status).toBe(404);
    expect((await post("/api/auth/sign-in/email", { email: "x@example.com", password: "long-enough-123" })).status).toBe(404);
    expect((await get("/api/auth/get-session")).status).toBe(404);
  });

  it("works without any cookie: data is read and written as the owner", async () => {
    const made = await post("/api/notes", { body: "local mode note" });
    expect(made.status).toBeLessThan(300);
    const list = await get("/api/notes");
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).toContain("local mode note");
  });
});
