import {
  Attachment, CalendarRange, Email, EmailListItem, EmailTemplate, Job, JobDetail, JobListItem, LinkedEmail, MailStatus,
  ParsedEvent, PetCatalog, PetResponse, PetState, Review, ReviewStats, StudyPlan, TemplateRef,
} from "@hyperfocus/shared";
import { describe, expect, it } from "vitest";
import { api, day, get, ok, post, put } from "../support/api.js";

// P3-03: the website's API types are generated from the OpenAPI document, so the documented response shapes must be
// what the API really sends. Each schema here is checked against a real answer: every documented field is there with
// the documented type, and the answer has no undocumented fields at the top level.

function exact(schema, value) {
  const r = schema.safeParse(value);
  expect(r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)).toEqual([]);
  const shape = schema.shape ?? schema.element?.shape;
  if (shape) for (const item of Array.isArray(value) ? value : [value]) expect(Object.keys(item).filter((k) => !(k in shape)), "undocumented fields").toEqual([]);
}
const upload = (path, content, { name = "f.txt", type = "text/plain" } = {}) =>
  api("POST", `${path}?name=${encodeURIComponent(name)}`, undefined, { raw: content, headers: { "Content-Type": "application/octet-stream", "X-File-Type": type } });

describe("documented responses match the real ones", () => {
  it("email", async () => {
    exact(MailStatus, await ok(get("/api/emails/status")));
    const e = await ok(post("/api/emails", { toAddr: "a@b.co", subject: "Doc", html: "<p>x</p>" }));
    exact(Email, e);
    exact(Attachment, await ok(upload(`/api/emails/${e.id}/attachments`, "file")));
    exact(Email, await ok(get(`/api/emails/${e.id}`)));
    exact(Email, await ok(put(`/api/emails/${e.id}`, { subject: "Doc 2", html: "<p>y</p>" })));
    exact(EmailListItem.array(), await ok(get("/api/emails")));
    const t = await ok(post(`/api/emails/${e.id}/save-template`, {}));
    exact(TemplateRef, t);
    exact(EmailTemplate.array(), await ok(get("/api/email-templates")));
    exact(Email, await ok(post(`/api/email-templates/${t.id}/use`)));
    exact(Email, await ok(post(`/api/emails/${e.id}/duplicate`)));
  });

  it("jobs", async () => {
    const j = await ok(post("/api/jobs", { company: "Docs Inc", contactEmail: "hr@docs.inc" }));
    exact(Job, j);
    exact(Job, await ok(api("PATCH", `/api/jobs/${j.id}`, { status: "applied" })));
    const draft = await ok(post(`/api/jobs/${j.id}/email`));
    exact(Email, draft);
    exact(LinkedEmail, await ok(put(`/api/emails/${draft.id}/job`, { jobId: j.id })));
    exact(JobDetail, await ok(get(`/api/jobs/${j.id}`)));
    exact(JobListItem.array(), await ok(get("/api/jobs")));
  });

  it("calendar", async () => {
    await ok(post("/api/events", { title: "Doc class", day: day(1), startTime: "09:00", endTime: "10:00", repeat: "weekly" }));
    await ok(post("/api/tasks", { title: "Doc task", dueDay: day(2) }));
    exact(CalendarRange, await ok(get(`/api/calendar?from=${day()}&to=${day(14)}`)));
    exact(ParsedEvent, await ok(post("/api/calendar/parse", { text: "study Friday 3pm" })));
    exact(StudyPlan, await ok(post("/api/calendar/plan")));
  });

  it("pet", async () => {
    exact(PetCatalog, await ok(get("/api/pet/catalog")));
    // the full pet state needs a pet (only one can exist, and another test file may have made it already)
    if ((await ok(get("/api/pet"))).pet === null) await ok(post("/api/pet", { name: "Docs", species: "cat", color: "#7447E6", gender: "girl" }));
    const state = await ok(get("/api/pet"));
    expect(state.pet).not.toBeNull();
    exact(PetState, state);
    expect(PetResponse.safeParse({ pet: null }).success).toBe(true);
  });

  it("weekly review (its numbers)", async () => {
    const r = await ok(post("/api/reviews"));
    exact(Review, r);
    exact(ReviewStats, r.stats);
    exact(Review.array(), await ok(get("/api/reviews")));
  });
});
