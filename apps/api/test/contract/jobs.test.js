import { describe, expect, it } from "vitest";
import { del, get, ok, patch, post, put } from "../support/api.js";

describe("job applications", () => {
  it("creates a job (company required) with wishlist as the default status", async () => {
    expect((await post("/api/jobs", { title: "Dev" })).body.error).toBe("Which company is it?");
    const j = await ok(post("/api/jobs", { company: " Acme ", title: "Engineer", notes: "n" }));
    expect(j).toMatchObject({ company: "Acme", title: "Engineer", status: "wishlist", appliedAt: null });
  });

  it("validates status, follow-up day and applied date", async () => {
    const j = await ok(post("/api/jobs", { company: "V" }));
    expect((await patch(`/api/jobs/${j.id}`, { status: "hired" })).body.error).toBe("Unknown status.");
    expect((await patch(`/api/jobs/${j.id}`, { followUpDay: "soon" })).status).toBe(400);
    expect((await patch(`/api/jobs/${j.id}`, { appliedAt: "nope" })).status).toBe(400);
    expect((await patch(`/api/jobs/${j.id}`, { company: "" })).status).toBe(400);
    expect((await patch("/api/jobs/999999", { notes: "x" })).status).toBe(404);
  });

  it("stamps the applied date the first time it leaves the wishlist", async () => {
    const j = await ok(post("/api/jobs", { company: "Stamp" }));
    const u = await ok(patch(`/api/jobs/${j.id}`, { status: "interview" }));
    expect(u.appliedAt).not.toBeNull();
  });

  it("starts an application email already linked, addressed and titled", async () => {
    const j = await ok(post("/api/jobs", { company: "Mailco", title: "Designer", contactEmail: "hr@mail.co" }));
    const e = await ok(post(`/api/jobs/${j.id}/email`));
    expect(e).toMatchObject({ jobId: j.id, toAddr: "hr@mail.co", subject: "Application: Designer at Mailco" });
    const detail = await ok(get(`/api/jobs/${j.id}`));
    expect(detail.emails.map((x) => x.id)).toContain(e.id);
    expect((await ok(get("/api/jobs"))).find((x) => x.id === j.id)).toMatchObject({ emailCount: 1, lastSentAt: null });
    expect((await post("/api/jobs/999999/email")).status).toBe(404);
  });

  it("links and unlinks an email", async () => {
    const j = await ok(post("/api/jobs", { company: "Link" }));
    const e = await ok(post("/api/emails", { subject: "s" }));
    expect((await ok(put(`/api/emails/${e.id}/job`, { jobId: j.id }))).jobId).toBe(j.id);
    expect((await ok(put(`/api/emails/${e.id}/job`, { jobId: null }))).jobId).toBeNull();
    expect((await put(`/api/emails/${e.id}/job`, { jobId: 999999 })).status).toBe(404);
    expect((await put("/api/emails/999999/job", { jobId: j.id })).status).toBe(404);
  });

  it("deleting a job keeps its emails, just unlinked", async () => {
    const j = await ok(post("/api/jobs", { company: "Gone" }));
    const e = await ok(post(`/api/jobs/${j.id}/email`));
    await ok(del(`/api/jobs/${j.id}`));
    expect((await get(`/api/jobs/${j.id}`)).status).toBe(404);
    expect((await ok(get(`/api/emails/${e.id}`))).jobId).toBeNull();
  });

  // P2-17: deleting a job that doesn't exist is a 404 (it was a quiet { ok: true })
  it("answers 404 for a job that doesn't exist", async () => {
    for (const r of [await del("/api/jobs/999999"), await get("/api/jobs/abc")]) {
      expect(r.status).toBe(404);
      expect(r.body.error).toBe("Job not found.");
    }
    expect((await put("/api/emails/abc/job", { jobId: null })).body.error).toBe("Email not found.");
  });
});
