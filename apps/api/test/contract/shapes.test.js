import { beforeAll, describe, expect, it } from "vitest";
import { api, day, get, ok, patch, post, put } from "../support/api.js";
import { shapeOf } from "../support/shape.js";

// P0-02: the shape of every read endpoint is frozen in __snapshots__/shapes.test.js.snap.
// The rewritten API (Hono, P2) must produce the same shapes, so the frontend keeps working.
// If a shape changes on purpose, update the snapshot with `npx vitest run -u` and say why in the PR.

const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
const only = (list, id) => list.filter((x) => x.id === id);
const f = {}; // fixtures: one fully filled record of everything

beforeAll(async () => {
  const pet = await ok(get("/api/pet"));
  if (!pet.pet) await ok(post("/api/pet", { name: "Shape", species: "fox", color: "#123456", gender: "boy" }));
  await ok(put("/api/profile", { name: "Ro", role: "Engineer", location: "Beirut", email: "ro@example.com", linkedin: "https://linkedin.com/in/ro", about: "a", helps: "b", avatar: "#7447e6" }));

  f.note = await ok(post("/api/notes", { body: "shape note", title: "t", kind: "post_idea" }));
  f.task = await ok(post("/api/tasks", { title: "shape task", today: true, dueDay: day(1), priority: "high" }));
  await ok(post(`/api/tasks/${f.task.id}/steps`, { steps: ["s1"] }));
  f.post = await ok(post("/api/posts", { thought: "shape post", draft: "draft", noteId: f.note.id }));
  f.study = await ok(post("/api/study", { course: "c", part: "p", notes: "n", startedAt: ago(90), endedAt: ago(30), breakMins: 5 }));
  f.goal = await ok(post("/api/goals", { original: "shape goal", targetDate: day(30) }));
  await ok(post(`/api/goals/${f.goal.id}/actions`, { texts: ["a1"] }));
  await ok(post(`/api/goals/${f.goal.id}/logs`, { text: "l1" }));
  f.skill = await ok(post("/api/skills", { name: "Shape skill", area: "Other", notes: "n", level: 2, target: 4 }));
  f.review = await ok(post("/api/reviews"));
  f.win = await ok(post("/api/wins", { text: "shape win" }));
  f.reminder = await ok(post("/api/reminders", { title: "shape reminder", at: new Date(Date.now() + 3600000).toISOString(), repeat: "weekly", note: "n" }));
  f.chat = await ok(post("/api/chat", { message: "shape chat" }));
  f.book = await ok(post("/api/books", { title: "Shape book", author: "A", notes: "n" }));
  await ok(post(`/api/books/${f.book.id}/ask`, { question: "q" }));
  f.event = await ok(post("/api/events", { title: "Shape event", day: day(1), startTime: "10:00", endTime: "11:00", category: "work", repeat: "weekly", repeatUntil: day(60), location: "L", notes: "N", remindMin: 15 }));
  f.job = await ok(post("/api/jobs", { company: "ShapeCo", title: "Dev", url: "https://x.co", location: "Remote", salary: "1", source: "site", contactName: "C", contactEmail: "c@x.co", notes: "n", followUpDay: day(7) }));
  f.email = await ok(post(`/api/jobs/${f.job.id}/email`));
  await ok(put(`/api/emails/${f.email.id}`, { toAddr: "c@x.co", ccAddr: "d@x.co", bccAddr: "", subject: "s", html: "<p>body</p>" }));
  await ok(api("POST", `/api/emails/${f.email.id}/attachments?name=cv.pdf`, undefined, { raw: "pdf", headers: { "Content-Type": "application/octet-stream", "X-File-Type": "application/pdf" } }));
  f.template = await ok(post(`/api/emails/${f.email.id}/save-template`, {}));
  await ok(post("/api/backups"));
  await ok(patch("/api/settings", { reminders: true }));
});

describe("response shapes of read endpoints", () => {
  const cases = [
    ["GET /api/health", () => get("/api/health")],
    ["GET /api/notes (item)", async () => only(await ok(get("/api/notes")), f.note.id)],
    ["GET /api/tasks (item)", async () => only(await ok(get("/api/tasks")), f.task.id)],
    ["GET /api/posts (item)", async () => only(await ok(get("/api/posts")), f.post.id)],
    ["GET /api/posts/:id", () => get(`/api/posts/${f.post.id}`)],
    ["GET /api/study (item)", async () => only(await ok(get("/api/study")), f.study.id)],
    ["GET /api/settings", () => get("/api/settings")],
    ["GET /api/wins (manual item)", async () => (await ok(get("/api/wins"))).filter((w) => w.winId === f.win.id)],
    ["GET /api/reviews (item)", async () => only(await ok(get("/api/reviews")), f.review.id)],
    ["GET /api/skills (item)", async () => only(await ok(get("/api/skills")), f.skill.id)],
    ["GET /api/profile", () => get("/api/profile")],
    ["GET /api/pet", () => get("/api/pet")],
    ["GET /api/pet/catalog", () => get("/api/pet/catalog")],
    ["GET /api/reminders (item)", async () => only(await ok(get("/api/reminders")), f.reminder.id)],
    ["GET /api/chat/threads (item)", async () => only(await ok(get("/api/chat/threads")), f.chat.thread.id)],
    ["GET /api/chat/threads/:id", () => get(`/api/chat/threads/${f.chat.thread.id}`)],
    ["GET /api/backups", () => get("/api/backups")],
    ["GET /api/books (item)", async () => only(await ok(get("/api/books")), f.book.id)],
    ["GET /api/books/:id", () => get(`/api/books/${f.book.id}`)],
    ["GET /api/books/:id/chat", () => get(`/api/books/${f.book.id}/chat`)],
    ["GET /api/events (item)", async () => only(await ok(get("/api/events")), f.event.id)],
    ["GET /api/calendar", async () => {
      const c = await ok(get(`/api/calendar?from=${day()}&to=${day(7)}`));
      return { ...c, events: c.events.filter((e) => e.title === "Shape event"), tasks: only(c.tasks, f.task.id), goals: [], study: [], posts: [] };
    }],
    ["GET /api/goals (item)", async () => only(await ok(get("/api/goals")), f.goal.id)],
    ["GET /api/emails/status", () => get("/api/emails/status")],
    ["GET /api/emails (item)", async () => only(await ok(get("/api/emails")), f.email.id)],
    ["GET /api/emails/:id", () => get(`/api/emails/${f.email.id}`)],
    ["GET /api/email-templates (item)", async () => only(await ok(get("/api/email-templates")), f.template.id)],
    ["GET /api/jobs (item)", async () => only(await ok(get("/api/jobs")), f.job.id)],
    ["GET /api/jobs/:id", () => get(`/api/jobs/${f.job.id}`)],
  ];

  for (const [name, load] of cases) {
    it(name, async () => {
      const r = await load();
      const body = r && typeof r === "object" && "status" in r && "body" in r && "headers" in r ? await ok(Promise.resolve(r)) : r;
      if (Array.isArray(body)) expect(body.length).toBeGreaterThan(0); // an empty list would hide the item shape
      expect(shapeOf(body)).toMatchSnapshot();
    });
  }
});
