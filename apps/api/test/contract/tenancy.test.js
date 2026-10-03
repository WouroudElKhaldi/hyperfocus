import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startExtraApi } from "../support/extra-api.js";
import { CLOUD, signUp } from "../support/people.js";

// P5-03 acceptance: "user A can never read or update user B's data, for every module" — generated from the API's own route
// list, so a route added later is covered without touching this test. Alice fills every module (each thing carries a
// secret word); Bob then calls EVERY route that takes an id, with each of Alice's ids, reading, changing and deleting.
// Nothing Bob gets back may contain Alice's secret, and Alice's whole view of the app must be exactly as before.

const SECRET = "ALICE-SECRET";
let api, alice, bob;
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

beforeAll(async () => {
  api = await startExtraApi("tenancy", CLOUD);
  [alice, bob] = await Promise.all([signUp(api, "alice@example.com", "Alice"), signUp(api, "bob@example.com", "Bob")]);
  // Alice: something in every module
  const a = (m, p, b) => alice.json(m, p, b);
  const note = await a("POST", "/api/notes", { body: `${SECRET} note`, title: SECRET });
  const task = await a("POST", "/api/tasks", { title: `${SECRET} task`, dueDay: day(1) });
  await a("POST", `/api/tasks/${task.id}/steps`, { steps: [`${SECRET} step`] });
  const goal = await a("POST", "/api/goals", { original: `${SECRET} goal`, targetDate: null });
  await a("POST", `/api/goals/${goal.id}/actions`, { texts: [`${SECRET} action`] });
  await a("POST", `/api/goals/${goal.id}/logs`, { text: `${SECRET} log` });
  await a("POST", "/api/skills", { name: `${SECRET} skill`, area: "Other" });
  const book = await a("POST", "/api/books", { title: `${SECRET} book` });
  await a("POST", `/api/books/${book.id}/ask`, { question: `${SECRET} question` });
  await a("POST", "/api/events", { title: `${SECRET} event`, day: day(2), startTime: "10:00", endTime: "11:00" });
  await a("POST", "/api/posts", { thought: `${SECRET} post`, noteId: note.id });
  await a("POST", "/api/study", { course: SECRET, part: "p", notes: SECRET, startedAt: new Date(Date.now() - 3600000).toISOString(), endedAt: new Date().toISOString() });
  await a("POST", "/api/wins", { text: `${SECRET} win` });
  await a("POST", "/api/reminders", { title: `${SECRET} reminder`, at: new Date(Date.now() + 86400000).toISOString() });
  await a("POST", "/api/chat", { message: `${SECRET} chat` });
  const job = await a("POST", "/api/jobs", { company: `${SECRET} company`, title: "t", url: "" });
  const email = await a("POST", `/api/jobs/${job.id}/email`);
  await a("PUT", `/api/emails/${email.id}`, { toAddr: "x@example.com", ccAddr: "", bccAddr: "", subject: SECRET, html: `<p>${SECRET}</p>` });
  await alice.call("POST", `/api/emails/${email.id}/attachments?name=secret.txt`, Buffer.from(SECRET), true);
  await a("POST", `/api/emails/${email.id}/save-template`, { name: SECRET });
  await a("PUT", "/api/profile", { name: `${SECRET} name`, role: "", location: "", email: "", linkedin: "", about: SECRET, helps: SECRET, avatar: "#7447e6" });
  await a("POST", "/api/pet", { name: SECRET, species: "fox", color: "#ff9f6b", gender: "girl", traits: [] });
  await a("POST", "/api/reviews");
}, 180000);
afterAll(() => api?.stop());

// every GET without a path parameter: a person's whole view of the app
const doc = () => fetch(`${api.url}/api/openapi.json`).then((r) => r.json());
async function viewOf(person) {
  const paths = Object.entries((await doc()).paths).filter(([p, ops]) => ops.get && !p.includes("{") && !/^\/api\/(health|export|openapi)/.test(p));
  const view = {};
  for (const [p] of paths) {
    const r = await person.call("GET", p === "/api/calendar" ? `/api/calendar?from=${day(-7)}&to=${day(30)}` : p); // (the calendar needs a range)
    view[p] = r.headers.get("content-type")?.includes("json") ? await r.json() : r.status;
  }
  return view;
}
// every id Alice has, anywhere in her view (numbers in "id" fields), and her books' address names
const idsIn = (value, out = new Set()) => {
  if (Array.isArray(value)) for (const v of value) idsIn(v, out);
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) {
    if (/(^id$|Id$)/.test(k) && typeof v === "number") out.add(String(v));
    idsIn(v, out);
  }
  return out;
};

describe("the tenancy guard (P5-03)", { timeout: 600000 }, () => {
  it("Bob sees nothing of Alice's in any list", async () => {
    const mine = JSON.stringify(await viewOf(bob));
    expect(mine).not.toContain(SECRET);
  });

  it("Bob can't read, change or delete any of Alice's things through any route, and Alice's data stays exactly the same", async () => {
    const before = await viewOf(alice);
    expect(JSON.stringify(before)).toContain(SECRET); // she really has data everywhere
    const ids = [...idsIn(before)];
    const books = (before["/api/books"] ?? []).map((b) => `${b.id}-x`);
    const routes = Object.entries((await doc()).paths).filter(([p]) => p.includes("{"));
    const attack = { title: "BOB", body: "BOB", text: "BOB", name: "BOB", original: "BOB", thought: "BOB", draft: "BOB", done: true, status: "archived", at: new Date().toISOString(), texts: ["BOB"], steps: ["BOB"], question: "BOB", message: "BOB" };
    let tried = 0;
    const leaks = [];
    for (const [path, ops] of routes) {
      for (const method of Object.keys(ops).filter((m) => ["get", "post", "put", "patch", "delete"].includes(m))) {
        for (const id of path.includes("{slug}") ? books : ids) {
          const url = path.replace(/\{[^}]+\}/g, id);
          const r = await bob.call(method.toUpperCase(), url, method === "get" || method === "delete" ? undefined : attack);
          tried++;
          const text = await r.text();
          if (text.includes(SECRET)) leaks.push(`${method.toUpperCase()} ${url} → ${r.status}`);
        }
      }
    }
    // (a fresh database: Alice made the first row everywhere, so her ids are few; every route and method gets each of them)
    const routeMethods = routes.reduce((n, [, ops]) => n + Object.keys(ops).filter((m) => ["get", "post", "put", "patch", "delete"].includes(m)).length, 0);
    expect(tried).toBeGreaterThanOrEqual(routeMethods);
    expect(leaks, "Bob got Alice's data back").toEqual([]);
    expect(await viewOf(alice), "Alice's data changed").toEqual(before);
  });
});
