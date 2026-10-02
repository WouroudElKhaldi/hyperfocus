import { describe, expect, it } from "vitest";
import { api, del, get, ok, post, put } from "../support/api.js";

const upload = (path, content, { name = "file.txt", type = "text/plain", inline = false } = {}) =>
  api("POST", `${path}?name=${encodeURIComponent(name)}${inline ? "&inline=1" : ""}`, undefined, { raw: content, headers: { "Content-Type": "application/octet-stream", "X-File-Type": type } });

describe("emails", () => {
  it("reports Gmail as not configured in tests", async () => {
    expect(await ok(get("/api/emails/status"))).toEqual({ ready: false, user: "", hasKey: false, hasUser: false });
  });

  it("creates an empty draft and a filled one", async () => {
    expect(await ok(post("/api/emails", {}))).toMatchObject({ status: "draft", subject: "", attachments: [] });
    const e = await ok(post("/api/emails", { toAddr: " a@b.co ", subject: "Hi", html: "<p>Hello <b>there</b></p>" }));
    expect(e).toMatchObject({ toAddr: "a@b.co", subject: "Hi", html: "<p>Hello <b>there</b></p>", body: "Hello there" });
  });

  it("removes scripts and dangerous attributes from the HTML", async () => {
    const e = await ok(post("/api/emails", { html: `<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:x">l</a><img src="file:///c">` }));
    expect(e.html).not.toMatch(/script|onclick|javascript|file:/i);
    expect(e.html).toMatch(/<p>Hi<\/p>/);
  });

  it("gets, updates, lists (with preview) and deletes a draft", async () => {
    const e = await ok(post("/api/emails", { subject: "s" }));
    expect(await ok(get(`/api/emails/${e.id}`))).toMatchObject({ id: e.id, job: null });
    expect((await ok(put(`/api/emails/${e.id}`, { subject: "s2", html: "<p>body text</p>" }))).subject).toBe("s2");
    expect((await ok(get("/api/emails"))).find((x) => x.id === e.id)).toMatchObject({ subject: "s2", preview: "body text", files: 0 });
    expect(await ok(del(`/api/emails/${e.id}`))).toEqual({ ok: true });
    expect((await get(`/api/emails/${e.id}`)).status).toBe(404);
    expect((await put(`/api/emails/${e.id}`, { subject: "x" })).status).toBe(404);
  });

  it("uploads, downloads safely and deletes attachments", async () => {
    const e = await ok(post("/api/emails", {}));
    expect((await upload(`/api/emails/${e.id}/attachments`, "")).status).toBe(400);
    const a = await ok(upload(`/api/emails/${e.id}/attachments`, "hello file", { name: "../notes:1.txt", type: "text/html" }));
    expect(a).toMatchObject({ filename: ".._notes_1.txt", size: 10, inline: false });
    const d = await api("GET", `/api/emails/attachments/${a.id}`);
    expect(d.body).toBe("hello file");
    expect(d.headers.get("content-type")).toBe("application/octet-stream"); // never served as HTML
    expect(d.headers.get("x-content-type-options")).toBe("nosniff");
    expect(d.headers.get("content-disposition")).toMatch(/^attachment/);
    expect((await upload(`/api/emails/${e.id}/attachments`, "x", { type: "text/plain", inline: true })).status).toBe(400);
    const img = await ok(upload(`/api/emails/${e.id}/attachments`, "PNG", { name: "a.png", type: "image/png", inline: true }));
    expect((await api("GET", `/api/emails/attachments/${img.id}`)).headers.get("content-disposition")).toMatch(/^inline/);
    expect((await ok(get("/api/emails"))).find((x) => x.id === e.id).files).toBe(1); // inline images aren't counted as files
    await ok(del(`/api/emails/attachments/${a.id}`));
    expect((await api("GET", `/api/emails/attachments/${a.id}`)).status).toBe(404);
    expect((await upload("/api/emails/999999/attachments", "x")).status).toBe(404);
  });

  it("duplicates an email with its files, re-pointing inline images to the copies", async () => {
    const e = await ok(post("/api/emails", { subject: "orig" }));
    const img = await ok(upload(`/api/emails/${e.id}/attachments`, "PNG", { name: "a.png", type: "image/png", inline: true }));
    await ok(put(`/api/emails/${e.id}`, { subject: "orig", html: `<p>x</p><img src="/api/emails/attachments/${img.id}">` }));
    const copy = await ok(post(`/api/emails/${e.id}/duplicate`));
    expect(copy.id).not.toBe(e.id);
    expect(copy.attachments).toHaveLength(1);
    expect(copy.html).toContain(`/api/emails/attachments/${copy.attachments[0].id}`);
    expect((await post("/api/emails/999999/duplicate")).status).toBe(404);
  });

  it("refuses to send while Gmail is not set up, leaving the draft as it was", async () => {
    const e = await ok(post("/api/emails", { toAddr: "a@b.co", subject: "s", html: "<p>x</p>" }));
    const r = await post(`/api/emails/${e.id}/send`);
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/Gmail is not set up/);
    expect((await ok(get(`/api/emails/${e.id}`))).status).toBe("draft");
  });

  it("polishes an email with the AI, keeping the HTML", async () => {
    expect((await post("/api/ai/polish-email", { html: "<p></p>" })).status).toBe(400);
    const r = await ok(post("/api/ai/polish-email", { subject: "hi", html: "<p>Hello there</p>" }));
    expect(r).toEqual({ subject: "hi", html: "<p>Hello there</p>", changes: [] });
  });
});

describe("email templates", () => {
  it("saves an email as a template, renames, uses and deletes it", async () => {
    const e = await ok(post("/api/emails", { subject: "Cover letter", html: "<p>Dear team</p>" }));
    await ok(upload(`/api/emails/${e.id}/attachments`, "cv", { name: "cv.pdf", type: "application/pdf" }));
    const t = await ok(post(`/api/emails/${e.id}/save-template`, {}));
    expect(t).toEqual({ id: expect.any(Number), name: "Cover letter" });
    expect((await ok(get("/api/email-templates"))).find((x) => x.id === t.id)).toMatchObject({ preview: "Dear team", files: 1 });
    expect(await ok(api("PATCH", `/api/email-templates/${t.id}`, { name: "CV letter" }))).toEqual({ id: t.id, name: "CV letter" });
    expect((await api("PATCH", `/api/email-templates/${t.id}`, { name: "" })).status).toBe(400);
    await ok(upload(`/api/email-templates/${t.id}/attachments`, "extra", { name: "extra.txt" }));
    const draft = await ok(post(`/api/email-templates/${t.id}/use`));
    expect(draft).toMatchObject({ subject: "Cover letter", body: "Dear team" });
    expect(draft.attachments).toHaveLength(2);
    await ok(del(`/api/email-templates/${t.id}`));
    expect((await post(`/api/email-templates/${t.id}/use`)).status).toBe(404);
    expect((await post("/api/emails/999999/save-template", {})).status).toBe(404);
  });

  // P2-16: renaming a template that doesn't exist is a 404 (it was a 500); uploads say what is missing
  it("answers 404 for a missing template or email, naming it", async () => {
    expect((await api("PATCH", "/api/email-templates/999999", { name: "x" })).body.error).toBe("Template not found.");
    expect((await upload("/api/email-templates/999999/attachments", "x")).body.error).toBe("Template not found.");
    expect((await upload("/api/emails/999999/attachments", "x")).body.error).toBe("Email not found.");
    expect((await api("GET", "/api/emails/attachments/abc")).status).toBe(404);
  });
});
