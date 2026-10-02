import { SECURITY_HEADERS } from "../../web/security-headers.mjs";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@hyperfocus/db";
import { findBook, askAboutBook } from "./books.js";
import { gatherWeek, writeReview } from "./review.js";
import { notify, getSettings, saveSettings, remind } from "./notify.js";
import { award, awardAtLeast, awardCapture, XP, taskXp, studyXp, PRIORITIES, petState, catalogState, cleanPet } from "./pet.js";
import { companionReply, isCrisis } from "./chat.js";
import { checkReminders, checkMyReminders, REMINDER_REPEATS } from "./reminders.js";
import { buildCalendar, buildIcs, parseEventText, planStudyBlocks, CATEGORIES, REPEATS, DAY_RE, TIME_RE, toMin } from "./calendar.js";
import { createBackup, listBackups, backupPath, backupDir, startAutoBackup } from "./backup.js";
import { registerMail } from "./mail.js";
import { registerJobs } from "./jobs.js";
import { rewritePost, taskSteps, organize, analyzeGoal, polishDraft, suggestSkills, skillPlan, stuckHelp, winsSummary, postIdeas } from "./ai.js";

// Accept keys in apps/api/.env or in the project-root .env
dotenv.config({ path: new URL("../.env", import.meta.url) });
// Root values fill in anything still empty. They never override a value that is already set, so real environment
// variables (and apps/api/.env) always win, and an empty value never wipes out a filled one.
const rootEnv = dotenv.config({ path: new URL("../../../.env", import.meta.url), processEnv: {} }).parsed || {};
for (const [k, v] of Object.entries(rootEnv)) if (v && !process.env[k]) process.env[k] = v;

// DEMO_MODE is for showing the app to someone else. Secrets are removed so they can never be used or seen.
const DEMO = !!process.env.DEMO_MODE;
if (DEMO) process.env.NOTIFY_DRY_RUN = "1";
const prisma = new PrismaClient(); // note: Prisma reads apps/api/.env itself at this point, so secrets are removed after it
if (DEMO) for (const k of ["DEEPSEEK_API_KEY", "N8N_WEBHOOK_URL", "GOOGLE_BOOKS_API_KEY", "GMAIL_APP_KEY"]) delete process.env[k];
// The one place the LinkedIn webhook address is read. In the demo it is always empty.
const n8nUrl = () => (DEMO ? "" : process.env.N8N_WEBHOOK_URL || "");
const app = express();
app.use(cors({ origin: /^http:\/\/(localhost|127\.0\.0\.1):\d+$/ }));
app.use(express.json({ limit: "1mb" }));

// In the demo nothing can reach your real backups (they live in the project folder) or pop up notifications on this computer.
if (DEMO) app.use(["/api/backups", "/api/notify", "/api/emails", "/api/email-templates"], (_, res) => res.status(403).json({ error: "This is switched off in the demo." }));

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(e.message);
    res.status(e.status || 500).json({ error: e.message });
  });
const id = (req) => Number(req.params.id);

app.get("/api/health", (_, res) =>
  res.json({ ok: true, ai: !!process.env.DEEPSEEK_API_KEY, n8n: !!n8nUrl(), demo: DEMO }),
);

// ---------- Notes ----------
app.get("/api/notes", wrap(async (req, res) => {
  const where = req.query.kind ? { kind: String(req.query.kind) } : {};
  const notes = await prisma.note.findMany({ where, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], include: { posts: { select: { id: true, status: true } } } });
  // a note counts as "posted" once a post made from it is published
  res.json(notes.map(({ posts, ...n }) => ({ ...n, postIds: posts.map((p) => p.id), posted: posts.some((p) => p.status === "posted") })));
}));
app.post("/api/notes", wrap(async (req, res) => {
  const { kind = "thought", title = "", body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: "Write something first." });
  const note = await prisma.note.create({ data: { kind, title, body } });
  await awardCapture(prisma, "thought", note.id);
  res.json(note);
}));
app.patch("/api/notes/:id", wrap(async (req, res) => {
  const { kind, title, body, pinned, archived } = req.body;
  res.json(await prisma.note.update({ where: { id: id(req) }, data: { kind, title, body, pinned, archived } }));
}));
app.delete("/api/notes/:id", wrap(async (req, res) => {
  await prisma.note.delete({ where: { id: id(req) } });
  res.json({ ok: true });
}));

// ---------- Tasks ----------
const taskInclude = { steps: { orderBy: { id: "asc" } } };
app.get("/api/tasks", wrap(async (_, res) => {
  res.json(await prisma.task.findMany({ include: taskInclude, orderBy: [{ done: "asc" }, { createdAt: "desc" }] }));
}));
app.post("/api/tasks", wrap(async (req, res) => {
  if (!req.body.title?.trim()) return res.status(400).json({ error: "Task needs a title." });
  const priority = PRIORITIES.includes(req.body.priority) ? req.body.priority : "normal";
  const created = await prisma.task.create({ data: { title: req.body.title, today: !!req.body.today, dueDay: req.body.dueDay || null, priority }, include: taskInclude });
  await awardCapture(prisma, "task", created.id);
  res.json(created);
}));
app.patch("/api/tasks/:id", wrap(async (req, res) => {
  const { title, done, today } = req.body;
  const data = { title, today };
  if (req.body.priority !== undefined) {
    if (!PRIORITIES.includes(req.body.priority)) return res.status(400).json({ error: "Importance must be low, normal, high or urgent." });
    data.priority = req.body.priority;
  }
  if ("dueDay" in req.body) data.dueDay = req.body.dueDay || null;
  if (done !== undefined) {
    data.done = done;
    data.doneAt = done ? new Date() : null;
  }
  const task = await prisma.task.update({ where: { id: id(req) }, data, include: taskInclude });
  if (done === true) await award(prisma, `task:${task.id}`, "task", taskXp(task.priority), `Finished: ${task.title}`);
  res.json(task);
}));
app.delete("/api/tasks/:id", wrap(async (req, res) => {
  await prisma.task.delete({ where: { id: id(req) } });
  res.json({ ok: true });
}));
app.post("/api/tasks/:id/steps", wrap(async (req, res) => {
  const texts = req.body.steps ?? [req.body.text];
  await prisma.step.createMany({ data: texts.filter(Boolean).map((text) => ({ text, taskId: id(req) })) });
  res.json(await prisma.task.findUnique({ where: { id: id(req) }, include: taskInclude }));
}));
app.patch("/api/steps/:id", wrap(async (req, res) => {
  res.json(await prisma.step.update({ where: { id: id(req) }, data: { done: req.body.done } }));
}));
app.delete("/api/steps/:id", wrap(async (req, res) => {
  await prisma.step.delete({ where: { id: id(req) } });
  res.json({ ok: true });
}));

// ---------- Posts ----------
app.get("/api/posts", wrap(async (_, res) => {
  res.json(await prisma.post.findMany({ orderBy: { updatedAt: "desc" } }));
}));
app.get("/api/posts/:id", wrap(async (req, res) => {
  const p = await prisma.post.findUnique({ where: { id: id(req) } });
  p ? res.json(p) : res.status(404).json({ error: "Not found" });
}));
app.post("/api/posts", wrap(async (req, res) => {
  const { thought, noteId } = req.body;
  if (!thought?.trim()) return res.status(400).json({ error: "Write your thought first." });
  res.json(await prisma.post.create({ data: { thought, draft: req.body.draft ?? "", noteId: noteId ?? null } }));
}));
app.patch("/api/posts/:id", wrap(async (req, res) => {
  const { thought, draft } = req.body;
  res.json(await prisma.post.update({ where: { id: id(req) }, data: { thought, draft } }));
}));
app.delete("/api/posts/:id", wrap(async (req, res) => {
  await prisma.post.delete({ where: { id: id(req) } });
  res.json({ ok: true });
}));

app.post("/api/posts/:id/publish", wrap(async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: id(req) } });
  if (!post?.draft.trim()) return res.status(400).json({ error: "The draft is empty." });
  if (post.status === "posted") return res.status(409).json({ error: "This post is already posted." });
  if (post.status === "posting") return res.status(409).json({ error: "This post is being sent right now." });
  if (!n8nUrl()) return res.status(409).json({ error: "n8n_not_configured" });
  const r = await sendToN8n(post);
  if (!r.ok) return res.status(502).json({ error: r.error });
  const posted = await prisma.post.update({ where: { id: post.id }, data: { status: "posted", postedAt: new Date(), lastError: "" } });
  await award(prisma, `post:${post.id}`, "post", XP.post, "Published a LinkedIn post");
  res.json(posted);
}));
app.post("/api/posts/:id/mark-posted", wrap(async (req, res) => {
  const posted = await prisma.post.update({ where: { id: id(req) }, data: { status: "posted", postedAt: new Date(), lastError: "" } });
  await award(prisma, `post:${posted.id}`, "post", XP.post, "Published a LinkedIn post");
  res.json(posted);
}));

// ---------- Scheduled posting ----------
const MENTION = /(^|\s)@[\p{L}\d_]/u; // LinkedIn's API can't create real tags, so these must be posted by hand
const CATCH_UP_MS = 2 * 3600 * 1000; // if the app was closed at the scheduled time, still post when reopened within 2h
const RETRY_GAP_MS = 2 * 60 * 1000;
const MAX_ATTEMPTS = 3;

async function sendToN8n(post) {
  const hook = n8nUrl();
  if (!hook) return { ok: false, retry: false, error: "n8n_not_configured" };
  try {
    const r = await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: post.id, text: post.draft }),
      signal: AbortSignal.timeout(30000),
    });
    if (r.ok) return { ok: true };
    return { ok: false, retry: true, error: `n8n answered ${r.status}. Is the workflow published, and is LinkedIn still connected?` };
  } catch (e) {
    // a timeout is ambiguous: LinkedIn may already have the post, so never retry automatically
    if (e.name === "TimeoutError") return { ok: false, retry: false, error: "n8n did not answer in time. Check your LinkedIn profile before trying again, it may have posted." };
    return { ok: false, retry: true, error: "Can't reach n8n. Is it running?" };
  }
}

app.post("/api/posts/:id/schedule", wrap(async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: id(req) } });
  if (!post) return res.status(404).json({ error: "Post not found." });
  const when = parseDate(req.body.scheduledAt);
  if (!when) return res.status(400).json({ error: "Pick a valid date and time." });
  if (when.getTime() < Date.now() + 60000) return res.status(400).json({ error: "Pick a time at least a minute from now." });
  if (post.status === "posted") return res.status(409).json({ error: "This post is already posted." });
  if (post.status === "posting") return res.status(409).json({ error: "This post is being sent right now." });
  if (!post.draft.trim()) return res.status(400).json({ error: "The draft is empty." });
  if (post.draft.length > 3000) return res.status(400).json({ error: "The draft is over LinkedIn's 3000 character limit." });
  if (MENTION.test(post.draft)) return res.status(400).json({ error: "Posts that tag someone (@name) can't be auto-posted, because the tag would come out as plain text. Post it by hand on LinkedIn." });
  if (!n8nUrl()) return res.status(400).json({ error: "Auto-posting needs n8n connected (N8N_WEBHOOK_URL)." });
  res.json(await prisma.post.update({ where: { id: post.id }, data: { status: "scheduled", scheduledAt: when, attempts: 0, lastError: "", lastAttemptAt: null } }));
}));
app.post("/api/posts/:id/unschedule", wrap(async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: id(req) } });
  if (post?.status === "posting") return res.status(409).json({ error: "It's being sent right now, too late to cancel." });
  res.json(await prisma.post.update({ where: { id: id(req) }, data: { status: "draft", scheduledAt: null, attempts: 0, lastError: "" } }));
}));

let schedulerBusy = false;
async function runScheduler() {
  if (schedulerBusy) return;
  schedulerBusy = true;
  try {
    const now = new Date();
    const due = await prisma.post.findMany({ where: { status: "scheduled", scheduledAt: { lte: now } } });
    for (const p of due) {
      if (!p.attempts && now - p.scheduledAt > CATCH_UP_MS) {
        await prisma.post.update({ where: { id: p.id }, data: { status: "missed", lastError: "The app wasn't running at the scheduled time, and it's been too long to post it automatically. Reschedule or post it yourself." } });
        remind(`missed:${p.id}`, "⚠️ A scheduled post wasn't sent", "The app was closed at the scheduled time. Open it to reschedule or post it yourself.");
        continue;
      }
      if (p.lastAttemptAt && now - p.lastAttemptAt < RETRY_GAP_MS) continue;
      // claim it first so the same post can never be sent twice
      const claim = await prisma.post.updateMany({ where: { id: p.id, status: "scheduled" }, data: { status: "posting", lastAttemptAt: now } });
      if (claim.count !== 1) continue;
      if (!p.draft.trim() || p.draft.length > 3000 || MENTION.test(p.draft)) {
        await prisma.post.update({ where: { id: p.id }, data: { status: "failed", lastError: "The draft changed after scheduling (empty, too long, or it now tags someone), so it wasn't auto-posted." } });
        remind(`changed:${p.id}`, "⚠️ A scheduled post wasn't sent", "The draft changed after scheduling. Open the post to check it.");
        continue;
      }
      const r = await sendToN8n(p);
      if (r.ok) {
        await prisma.post.update({ where: { id: p.id }, data: { status: "posted", postedAt: new Date(), lastError: "" } });
        console.log(`Auto-posted post ${p.id}`);
        await award(prisma, `post:${p.id}`, "post", XP.post, "Published a LinkedIn post");
        remind(`posted:${p.id}`, "🎉 Your post is live on LinkedIn", (p.draft.split("\n")[0] || "").slice(0, 100));
      } else {
        const attempts = p.attempts + 1;
        const again = r.retry && attempts < MAX_ATTEMPTS;
        await prisma.post.update({ where: { id: p.id }, data: { status: again ? "scheduled" : "failed", attempts, lastError: r.error } });
        console.error(`Auto-post ${p.id} failed (${attempts}/${MAX_ATTEMPTS}): ${r.error}`);
        if (!again) remind(`failed:${p.id}:${attempts}`, "⚠️ Your scheduled post didn't go out", r.error.slice(0, 160));
      }
    }
  } catch (e) {
    console.error("Scheduler error:", e.message);
  } finally {
    schedulerBusy = false;
  }
}

// ---------- Study log ----------
const parseDate = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
app.get("/api/study", wrap(async (_, res) => {
  res.json(await prisma.studySession.findMany({ orderBy: { startedAt: "desc" } }));
}));
app.post("/api/study", wrap(async (req, res) => {
  const { course = "", part = "", notes = "" } = req.body;
  const startedAt = req.body.startedAt ? parseDate(req.body.startedAt) : new Date();
  const endedAt = req.body.endedAt ? parseDate(req.body.endedAt) : null;
  if (!startedAt) return res.status(400).json({ error: "Invalid start time." });
  if (req.body.endedAt && !endedAt) return res.status(400).json({ error: "Invalid end time." });
  if (endedAt && endedAt <= startedAt) return res.status(400).json({ error: "End time must be after the start time." });
  if (!endedAt) {
    const running = await prisma.studySession.findFirst({ where: { endedAt: null } });
    if (running) return res.status(409).json({ error: "A session is already running. Stop it first." });
  }
  // a manual session can record how many minutes of the span were breaks (not counted as study time)
  const breakMs = Math.max(0, Math.round(Number(req.body.breakMins) || 0)) * 60000;
  if (endedAt && breakMs >= endedAt - startedAt) return res.status(400).json({ error: "The break can't be as long as the whole session." });
  res.json(await prisma.studySession.create({ data: { course, part, notes, startedAt, endedAt, breakMs } }));
}));
app.patch("/api/study/:id", wrap(async (req, res) => {
  const { course, part, notes } = req.body;
  const data = { course, part, notes };
  if (req.body.startedAt) data.startedAt = parseDate(req.body.startedAt);
  if (req.body.endedAt) data.endedAt = parseDate(req.body.endedAt);
  if (data.startedAt === null || data.endedAt === null) return res.status(400).json({ error: "Invalid time." });
  if (req.body.breakMins !== undefined) data.breakMs = Math.max(0, Math.round(Number(req.body.breakMins) || 0)) * 60000;
  const cur = await prisma.studySession.findUnique({ where: { id: id(req) } });
  const s = data.startedAt ?? cur.startedAt, e = data.endedAt ?? cur.endedAt;
  if (e && e <= s) return res.status(400).json({ error: "End time must be after the start time." });
  if (e && (data.breakMs ?? cur.breakMs) >= e - s) return res.status(400).json({ error: "The break can't be as long as the whole session." });
  // A saved session can be extended but never shortened (1 minute of slack for minute-precision date fields).
  if (cur.endedAt && e) {
    const before = cur.endedAt - cur.startedAt - cur.breakMs;
    const after = e - s - (data.breakMs ?? cur.breakMs);
    if (after < before - 60000) return res.status(400).json({ error: "You can add time to a saved session but not remove it. If it was a mistake, delete the session instead." });
  }
  res.json(await prisma.studySession.update({ where: { id: id(req) }, data }));
}));
// Undo an accidental stop: reopen the session. The time between stopping and continuing counts as a break.
const CONTINUE_WITHIN_MS = 6 * 3600 * 1000;
app.post("/api/study/:id/continue", wrap(async (req, res) => {
  const cur = await prisma.studySession.findUnique({ where: { id: id(req) } });
  if (!cur) return res.status(404).json({ error: "Session not found." });
  if (!cur.endedAt) return res.json(cur); // already running
  if (await prisma.studySession.findFirst({ where: { endedAt: null } })) return res.status(409).json({ error: "Another session is running. Stop it first." });
  const gap = Date.now() - cur.endedAt;
  if (gap > CONTINUE_WITHIN_MS) return res.status(409).json({ error: "That session ended more than 6 hours ago. Start a new session for the same part instead." });
  res.json(await prisma.studySession.update({ where: { id: cur.id }, data: { endedAt: null, pausedAt: null, breakMs: cur.breakMs + gap } }));
}));
// Pause = a break starts. Resume = the break is added to breakMs and study time continues.
app.post("/api/study/:id/pause", wrap(async (req, res) => {
  const cur = await prisma.studySession.findUnique({ where: { id: id(req) } });
  if (!cur || cur.endedAt) return res.status(409).json({ error: "This session isn't running." });
  if (cur.pausedAt) return res.json(cur); // already on a break
  res.json(await prisma.studySession.update({ where: { id: cur.id }, data: { pausedAt: new Date() } }));
}));
app.post("/api/study/:id/resume", wrap(async (req, res) => {
  const cur = await prisma.studySession.findUnique({ where: { id: id(req) } });
  if (!cur || cur.endedAt) return res.status(409).json({ error: "This session isn't running." });
  if (!cur.pausedAt) return res.json(cur); // not on a break
  res.json(await prisma.studySession.update({ where: { id: cur.id }, data: { breakMs: cur.breakMs + (Date.now() - cur.pausedAt), pausedAt: null } }));
}));
app.post("/api/study/:id/stop", wrap(async (req, res) => {
  const cur = await prisma.studySession.findUnique({ where: { id: id(req) } });
  if (!cur) return res.status(404).json({ error: "Session not found." });
  if (cur.endedAt) return res.json(cur);
  // Stopping during a break ends the session when the break began, so the time you were away is never counted.
  const stopped = await prisma.studySession.update({ where: { id: cur.id }, data: { endedAt: cur.pausedAt ?? new Date(), pausedAt: null } });
  const activeMin = Math.round((stopped.endedAt - stopped.startedAt - stopped.breakMs) / 60000);
  await awardAtLeast(prisma, `study:${stopped.id}`, "study", studyXp(activeMin), `Studied ${activeMin} min${stopped.course ? ": " + stopped.course : ""}`);
  res.json(stopped);
}));
app.delete("/api/study/:id", wrap(async (req, res) => {
  await prisma.studySession.delete({ where: { id: id(req) } });
  res.json({ ok: true });
}));

// ---------- Settings & reminders ----------
app.get("/api/settings", wrap(async (_, res) => {
  const { sent, ...rest } = getSettings();
  res.json(rest);
}));
app.patch("/api/settings", wrap(async (req, res) => {
  const { sent, ...rest } = saveSettings({ ...req.body, sent: undefined });
  res.json(rest);
}));
app.post("/api/notify/test", wrap(async (_, res) => {
  const r = await notify("💜 Hyperfocus", "This is how your reminders will look.");
  if (!r.ok) return res.status(500).json({ error: "Couldn't show a notification: " + r.error });
  res.json({ ok: true });
}));

app.post("/api/ai/post-ideas", wrap(async (req, res) => {
  const { course = "", part = "", notes = "" } = req.body;
  if (notes.trim().length < 15) return res.status(400).json({ error: "Write a few more notes first, so there's something to build a post from." });
  res.json({ ideas: await postIdeas({ course, part, notes: notes.slice(0, 4000) }) });
}));

// ---------- Wins ----------
// Her own wins plus everything she finished, merged into one timeline (newest first).
async function allWins() {
  const since = new Date(Date.now() - 180 * 86400000);
  const [manual, tasks, posts, sessions] = await Promise.all([
    prisma.win.findMany({ where: { createdAt: { gte: since } } }),
    prisma.task.findMany({ where: { doneAt: { gte: since } } }),
    prisma.post.findMany({ where: { postedAt: { gte: since } } }),
    prisma.studySession.findMany({ where: { endedAt: { gte: since } } }),
  ]);
  const minutes = (s) => Math.round((s.endedAt - s.startedAt - s.breakMs) / 60000);
  const list = [
    ...manual.map((w) => ({ id: `win-${w.id}`, kind: "win", text: w.text, date: w.createdAt.toISOString(), manual: true, winId: w.id })),
    ...tasks.map((t) => ({ id: `task-${t.id}`, kind: "task", text: `Finished: ${t.title}`, date: t.doneAt.toISOString() })),
    ...posts.map((p) => ({ id: `post-${p.id}`, kind: "post", text: `Published a LinkedIn post: "${(p.draft || p.thought).split("\n").find((l) => l.trim()).slice(0, 90)}"`, date: p.postedAt.toISOString() })),
    ...sessions.filter((s) => minutes(s) >= 5).map((s) => ({ id: `study-${s.id}`, kind: "study", text: `Studied ${minutes(s)} min${s.course ? `: ${s.course}` : ""}${s.part ? ` / ${s.part}` : ""}`, date: s.endedAt.toISOString() })),
  ];
  return list.sort((a, b) => b.date.localeCompare(a.date));
}
app.get("/api/wins", wrap(async (_, res) => res.json(await allWins())));
app.post("/api/wins", wrap(async (req, res) => {
  if (!req.body.text?.trim()) return res.status(400).json({ error: "Write what you did." });
  const w = await prisma.win.create({ data: { text: req.body.text.trim() } });
  await award(prisma, `win:${w.id}`, "win", XP.win, w.text);
  res.json(w);
}));
app.delete("/api/wins/:id", wrap(async (req, res) => {
  await prisma.win.delete({ where: { id: id(req) } });
  res.json({ ok: true });
}));
app.post("/api/wins/summary", wrap(async (_, res) => {
  const wins = (await allWins()).slice(0, 150);
  if (wins.length < 3) return res.status(400).json({ error: "Log a few more wins first. There isn't enough here to summarise yet." });
  res.json(await winsSummary(wins));
}));

// ---------- "I'm stuck" helper ----------
app.post("/api/stuck", wrap(async (req, res) => {
  const tasks = await prisma.task.findMany({ where: { done: false }, orderBy: { createdAt: "desc" }, take: 12 });
  const running = await prisma.studySession.findFirst({ where: { endedAt: null } });
  res.json(await stuckHelp({
    energy: ["low", "ok", "high"].includes(req.body.energy) ? req.body.energy : "ok",
    blocker: String(req.body.blocker || "").slice(0, 600),
    todayTasks: tasks.filter((t) => t.today).map((t) => t.title),
    openTasks: tasks.filter((t) => !t.today).map((t) => t.title),
    studying: !!running,
  }));
}));

// ---------- Weekly review ----------
const reviewOut = (r) => ({ id: r.id, label: r.label, createdAt: r.createdAt, stats: JSON.parse(r.stats), content: JSON.parse(r.content) });
app.get("/api/reviews", wrap(async (_, res) => {
  res.json((await prisma.review.findMany({ orderBy: { createdAt: "desc" }, take: 30 })).map(reviewOut));
}));
app.post("/api/reviews", wrap(async (_, res) => {
  const { stats, facts, label } = await gatherWeek(prisma);
  const content = await writeReview(facts);
  const r = await prisma.review.create({ data: { label, stats: JSON.stringify(stats), content: JSON.stringify(content) } });
  await award(prisma, `review:${r.id}`, "review", XP.review, "Did a weekly review");
  res.json(reviewOut(r));
}));
app.delete("/api/reviews/:id", wrap(async (req, res) => {
  await prisma.review.delete({ where: { id: id(req) } });
  res.json({ ok: true });
}));

// ---------- Skills gap map ----------
const clampLevel = (n) => Math.min(5, Math.max(0, Math.round(Number(n) || 0)));
app.get("/api/skills", wrap(async (_, res) => {
  res.json(await prisma.skill.findMany({ orderBy: [{ area: "asc" }, { createdAt: "asc" }] }));
}));
app.post("/api/skills", wrap(async (req, res) => {
  const { name, area = "", notes = "" } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Give the skill a name." });
  res.json(await prisma.skill.create({ data: { name: name.trim(), area, notes, level: clampLevel(req.body.level), target: clampLevel(req.body.target ?? 4) || 4 } }));
}));
app.post("/api/skills/bulk", wrap(async (req, res) => {
  const existing = new Set((await prisma.skill.findMany()).map((s) => s.name.toLowerCase()));
  const items = (req.body.items || []).filter((i) => i.name?.trim() && !existing.has(i.name.trim().toLowerCase()));
  await prisma.skill.createMany({ data: items.map((i) => ({ name: i.name.trim(), area: i.area || "", notes: i.why || "" })) });
  res.json(await prisma.skill.findMany({ orderBy: [{ area: "asc" }, { createdAt: "asc" }] }));
}));
app.patch("/api/skills/:id", wrap(async (req, res) => {
  const { name, area, notes } = req.body;
  const data = { name, area, notes };
  if (req.body.level !== undefined) data.level = clampLevel(req.body.level);
  if (req.body.target !== undefined) data.target = clampLevel(req.body.target) || 1;
  const before = await prisma.skill.findUnique({ where: { id: id(req) } });
  const skill = await prisma.skill.update({ where: { id: id(req) }, data });
  if (before && skill.level > before.level) await award(prisma, `skill:${skill.id}:${skill.level}`, "skill", XP.skill, `Skill level up: ${skill.name}`);
  res.json(skill);
}));
app.delete("/api/skills/:id", wrap(async (req, res) => {
  await prisma.skill.delete({ where: { id: id(req) } });
  res.json({ ok: true });
}));
app.post("/api/skills/suggest", wrap(async (req, res) => {
  if (!req.body.context?.trim()) return res.status(400).json({ error: "Tell me a little about what feels shaky or what you work on." });
  const existing = (await prisma.skill.findMany()).map((s) => s.name);
  res.json({ skills: await suggestSkills({ context: req.body.context, existing }) });
}));
app.post("/api/skills/:id/plan", wrap(async (req, res) => {
  const s = await prisma.skill.findUnique({ where: { id: id(req) } });
  if (!s) return res.status(404).json({ error: "Skill not found." });
  res.json(await skillPlan({ name: s.name, level: s.level, target: s.target }));
}));

// ---------- Profile (the person using the app; no login, just saved here) ----------
const PROFILE_MAX = { name: 60, role: 80, location: 80, email: 120, linkedin: 200, about: 600, helps: 800 };
const EMPTY_PROFILE = { name: "", role: "", location: "", email: "", linkedin: "", about: "", helps: "", avatar: "#7447e6" };
app.get("/api/profile", wrap(async (_, res) => res.json((await prisma.profile.findFirst()) ?? EMPTY_PROFILE)));
app.put("/api/profile", wrap(async (req, res) => {
  const d = {};
  for (const [k, max] of Object.entries(PROFILE_MAX)) if (req.body[k] !== undefined) d[k] = String(req.body[k]).trim().slice(0, max);
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return res.status(400).json({ error: "That email doesn't look right." });
  if (d.linkedin && !/^https?:\/\/\S+\.\S+/.test(d.linkedin)) return res.status(400).json({ error: "The LinkedIn link should start with https://" });
  if (req.body.avatar !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(req.body.avatar)) return res.status(400).json({ error: "Pick a color for your avatar." });
    d.avatar = req.body.avatar.toLowerCase();
  }
  const cur = await prisma.profile.findFirst();
  res.json(cur ? await prisma.profile.update({ where: { id: cur.id }, data: d }) : await prisma.profile.create({ data: d }));
}));

// ---------- Companion pet ----------
app.get("/api/pet", wrap(async (_, res) => res.json(await petState(prisma))));
app.get("/api/pet/catalog", wrap(async (_, res) => res.json(catalogState())));
app.post("/api/pet", wrap(async (req, res) => {
  if (await prisma.pet.findFirst()) return res.status(409).json({ error: "You already have a pet." });
  const c = cleanPet(req.body); // a new pet has earned nothing yet, so only the free clothes are available
  if (c.error) return res.status(400).json({ error: c.error });
  await prisma.pet.create({ data: c.data });
  res.json(await petState(prisma));
}));
app.patch("/api/pet", wrap(async (req, res) => {
  const pet = await prisma.pet.findFirst();
  if (!pet) return res.status(404).json({ error: "No pet yet." });
  const state = await petState(prisma);
  const c = cleanPet(req.body, state, true);
  if (c.error) return res.status(400).json({ error: c.error });
  await prisma.pet.update({ where: { id: pet.id }, data: c.data });
  res.json(await petState(prisma));
}));

// ---------- My reminders ----------
function cleanReminder(b, partial = false) {
  const d = {};
  if (!partial || b.title !== undefined) { const t = String(b.title ?? "").trim().slice(0, 120); if (!t) return { error: "Say what to remind you about." }; d.title = t; }
  if (!partial || b.at !== undefined) { const at = new Date(b.at); if (!b.at || Number.isNaN(at.getTime())) return { error: "Pick a day and time." }; d.at = at; }
  if (b.repeat !== undefined) { if (!REMINDER_REPEATS.includes(b.repeat)) return { error: "That repeat isn't available." }; d.repeat = b.repeat; }
  if (b.note !== undefined) d.note = String(b.note).trim().slice(0, 300);
  return { data: d };
}
app.get("/api/reminders", wrap(async (_, res) => {
  const since = new Date(Date.now() - 7 * 86400000);
  const rows = await prisma.reminder.findMany({ where: { OR: [{ done: false }, { lastFiredAt: { gte: since } }] }, orderBy: [{ done: "asc" }, { at: "asc" }] });
  res.json(rows);
}));
app.post("/api/reminders", wrap(async (req, res) => {
  const c = cleanReminder(req.body);
  if (c.error) return res.status(400).json({ error: c.error });
  res.json(await prisma.reminder.create({ data: c.data }));
}));
app.patch("/api/reminders/:id", wrap(async (req, res) => {
  const c = cleanReminder(req.body, true);
  if (c.error) return res.status(400).json({ error: c.error });
  if (c.data.at && c.data.at > new Date()) c.data.done = false; // moving it to the future re-arms it
  res.json(await prisma.reminder.update({ where: { id: +req.params.id }, data: c.data }));
}));
app.delete("/api/reminders/:id", wrap(async (req, res) => {
  await prisma.reminder.deleteMany({ where: { id: +req.params.id } });
  res.json({ ok: true });
}));

// ---------- Support chat ----------
// Conversations are saved as threads. A "temporary" chat is sent with its own history and is never written to the database.
const threadTitle = (text) => { const t = String(text).replace(/\s+/g, " ").trim(); return t.length > 44 ? t.slice(0, 41).trimEnd() + "..." : t || "New chat"; };
async function adoptOldMessages() { // messages from before threads existed become one earlier conversation
  const old = await prisma.chatMessage.findMany({ where: { threadId: null }, orderBy: { id: "asc" } });
  if (!old.length) return;
  const first = old.find((m) => m.role === "user");
  const th = await prisma.chatThread.create({ data: { title: first ? threadTitle(first.content) : "Earlier chat", createdAt: old[0].createdAt, updatedAt: old[old.length - 1].createdAt } });
  await prisma.chatMessage.updateMany({ where: { threadId: null }, data: { threadId: th.id } });
}
app.get("/api/chat/threads", wrap(async (_, res) => {
  await adoptOldMessages();
  const rows = await prisma.chatThread.findMany({ orderBy: [{ updatedAt: "desc" }, { id: "desc" }], include: { _count: { select: { messages: true } } } });
  res.json(rows.map((t) => ({ id: t.id, title: t.title, updatedAt: t.updatedAt, createdAt: t.createdAt, count: t._count.messages })));
}));
app.post("/api/chat/threads", wrap(async (_, res) => res.json(await prisma.chatThread.create({ data: {} }))));
app.get("/api/chat/threads/:id", wrap(async (req, res) => {
  const t = await prisma.chatThread.findUnique({ where: { id: +req.params.id } });
  if (!t) return res.status(404).json({ error: "That chat was not found." });
  res.json({ thread: t, messages: await prisma.chatMessage.findMany({ where: { threadId: t.id }, orderBy: { id: "asc" } }) });
}));
app.patch("/api/chat/threads/:id", wrap(async (req, res) => {
  const title = String(req.body.title || "").trim().slice(0, 80);
  if (!title) return res.status(400).json({ error: "Give the chat a name." });
  res.json(await prisma.chatThread.update({ where: { id: +req.params.id }, data: { title } }));
}));
app.delete("/api/chat/threads/:id", wrap(async (req, res) => {
  await prisma.chatMessage.deleteMany({ where: { threadId: +req.params.id } });
  await prisma.chatThread.deleteMany({ where: { id: +req.params.id } });
  res.json({ ok: true });
}));
app.delete("/api/chat/threads", wrap(async (_, res) => {
  await prisma.chatMessage.deleteMany();
  await prisma.chatThread.deleteMany();
  res.json({ ok: true });
}));

app.post("/api/chat", wrap(async (req, res) => {
  const message = String(req.body.message || "").trim().slice(0, 2000);
  if (!message) return res.status(400).json({ error: "Write something first." });
  const temporary = req.body.temporary === true;
  let thread = null;
  let history;
  if (temporary) {
    history = (Array.isArray(req.body.history) ? req.body.history : []).filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string").slice(-24).map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  } else {
    thread = req.body.threadId ? await prisma.chatThread.findUnique({ where: { id: +req.body.threadId } }) : null;
    if (req.body.threadId && !thread) return res.status(404).json({ error: "That chat was not found." });
    history = thread ? (await prisma.chatMessage.findMany({ where: { threadId: thread.id }, orderBy: { id: "desc" }, take: 24 })).reverse() : [];
  }
  // a little context about her day, so the replies fit. It is used lightly and never shown back.
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [tasks, today, running] = await Promise.all([
    prisma.task.findMany({ where: { done: false, OR: [{ today: true }, { dueDay: new Date().toISOString().slice(0, 10) }] }, take: 5 }),
    prisma.studySession.findMany({ where: { startedAt: { gte: start }, endedAt: { not: null } } }),
    prisma.studySession.findFirst({ where: { endedAt: null } }),
  ]);
  const studied = Math.round(today.reduce((t, x) => t + (x.endedAt - x.startedAt - x.breakMs) / 60000, 0));
  const prof = await prisma.profile.findFirst();
  const about = prof
    ? `. Her name is ${prof.name || "(not given)"}${prof.role ? `; she works as ${prof.role}` : ""}${prof.about ? `; about her: ${prof.about}` : ""}${prof.helps ? `; what helps her, in her own words: ${prof.helps}` : ""}`
    : "";
  const context = `it is ${new Date().toLocaleString("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit" })}; studied today: ${studied} min${running ? " (a study session is running now)" : ""}; tasks for today: ${tasks.map((t) => t.title).join("; ") || "none listed"}${about}`;
  const reply = await companionReply({ history, message, context });
  const crisis = isCrisis(message);
  if (temporary) {
    const now = new Date().toISOString();
    return res.json({ user: { id: `t${Date.now()}u`, role: "user", content: message, createdAt: now }, assistant: { id: `t${Date.now()}a`, role: "assistant", content: reply, createdAt: now }, crisis, temporary: true });
  }
  if (!thread) thread = await prisma.chatThread.create({ data: { title: threadTitle(message) } });
  else if (!history.length) thread = await prisma.chatThread.update({ where: { id: thread.id }, data: { title: threadTitle(message) } });
  const userMsg = await prisma.chatMessage.create({ data: { role: "user", content: message, threadId: thread.id } });
  const botMsg = await prisma.chatMessage.create({ data: { role: "assistant", content: reply, threadId: thread.id } });
  thread = await prisma.chatThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
  res.json({ user: userMsg, assistant: botMsg, crisis, thread });
}));

// ---------- Backups ----------
app.get("/api/backups", wrap(async (_, res) => {
  res.json({ backups: listBackups(), folder: backupDir() });
}));
app.post("/api/backups", wrap(async (_, res) => {
  const name = await createBackup(prisma);
  res.json({ name, backups: listBackups(), folder: backupDir() });
}));
app.get("/api/backups/:name/download", wrap(async (req, res) => {
  const file = backupPath(req.params.name);
  if (!file) return res.status(404).json({ error: "Backup not found." });
  res.download(file, req.params.name);
}));

// ---------- Books ----------
app.get("/api/books", wrap(async (_, res) => {
  res.json(await prisma.book.findMany({ orderBy: { createdAt: "desc" } }));
}));
app.post("/api/books", wrap(async (req, res) => {
  const { title, author = "", notes = "" } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "Write the book's title." });
  res.json(await prisma.book.create({ data: { title: title.trim(), author: author.trim(), notes } }));
}));
app.patch("/api/books/:id", wrap(async (req, res) => {
  const { title, author, status, notes } = req.body;
  const book = await prisma.book.update({ where: { id: id(req) }, data: { title, author, status, notes } });
  if (status === "done") await award(prisma, `book:${book.id}`, "book", XP.book, `Finished a book: ${book.title}`);
  res.json(book);
}));
app.delete("/api/books/:id", wrap(async (req, res) => {
  await prisma.book.delete({ where: { id: id(req) } });
  res.json({ ok: true });
}));
app.get("/api/books/:id", wrap(async (req, res) => {
  const book = await prisma.book.findUnique({ where: { id: id(req) } });
  if (!book) return res.status(404).json({ error: "That book was not found." });
  res.json(book);
}));
app.get("/api/books/:id/chat", wrap(async (req, res) => {
  res.json(await prisma.bookMessage.findMany({ where: { bookId: id(req) }, orderBy: { id: "asc" } }));
}));
app.post("/api/books/:id/ask", wrap(async (req, res) => {
  const book = await prisma.book.findUnique({ where: { id: id(req) } });
  if (!book) return res.status(404).json({ error: "That book was not found." });
  const question = String(req.body.question || "").trim().slice(0, 1500);
  if (!question) return res.status(400).json({ error: "Write your question first." });
  const history = (await prisma.bookMessage.findMany({ where: { bookId: book.id }, orderBy: { id: "desc" }, take: 16 })).reverse();
  const prof = await prisma.profile.findFirst();
  const reply = await askAboutBook({ book, result: book.result, history, question, helps: prof?.helps || "" });
  const user = await prisma.bookMessage.create({ data: { bookId: book.id, role: "user", content: question } });
  const assistant = await prisma.bookMessage.create({ data: { bookId: book.id, role: "assistant", content: reply } });
  res.json({ user, assistant });
}));
app.delete("/api/books/:id/chat", wrap(async (req, res) => {
  await prisma.bookMessage.deleteMany({ where: { bookId: id(req) } });
  res.json({ ok: true });
}));
app.post("/api/books/:id/find", wrap(async (req, res) => {
  const book = await prisma.book.findUnique({ where: { id: id(req) } });
  if (!book) return res.status(404).json({ error: "Book not found." });
  const result = await findBook({ title: book.title, author: book.author });
  res.json(await prisma.book.update({
    where: { id: book.id },
    data: { result: JSON.stringify(result), foundAt: new Date(), author: book.author || result.foundAuthor },
  }));
}));

// ---------- Calendar ----------
// Validates and cleans the fields of an event. With partial=true only the fields that were sent are returned.
function cleanEvent(b, partial = false) {
  const d = {};
  const has = (k) => b[k] !== undefined;
  if (!partial || has("title")) {
    if (!String(b.title || "").trim()) return { error: "Give the event a title." };
    d.title = String(b.title).trim().slice(0, 160);
  }
  if (!partial || has("day")) {
    if (!DAY_RE.test(b.day || "")) return { error: "Pick a valid date." };
    d.day = b.day;
  }
  if (has("allDay")) d.allDay = !!b.allDay;
  if (d.allDay) { d.startTime = ""; d.endTime = ""; }
  else {
    for (const k of ["startTime", "endTime"]) {
      if (!has(k)) continue;
      if (b[k] !== "" && !TIME_RE.test(b[k])) return { error: "Times look like 14:30." };
      d[k] = b[k];
    }
    if (d.startTime && d.endTime && toMin(d.endTime) <= toMin(d.startTime)) return { error: "The end must be after the start." };
    if (!partial && !d.startTime && !has("allDay")) d.allDay = true;
  }
  if (has("category")) d.category = CATEGORIES.includes(b.category) ? b.category : "event";
  if (has("repeat")) d.repeat = REPEATS.includes(b.repeat) ? b.repeat : "none";
  if (has("repeatUntil")) {
    if (b.repeatUntil && !DAY_RE.test(b.repeatUntil)) return { error: "Pick a valid end date for the repeat." };
    d.repeatUntil = b.repeatUntil || "";
  }
  if (has("location")) d.location = String(b.location || "").slice(0, 200);
  if (has("notes")) d.notes = String(b.notes || "").slice(0, 4000);
  if (has("remindMin")) {
    const n = Number(b.remindMin);
    d.remindMin = Number.isFinite(n) && n >= 0 && n <= 10080 ? Math.round(n) : -1;
  }
  return { data: d };
}

app.get("/api/events", wrap(async (_, res) => {
  res.json(await prisma.event.findMany({ orderBy: [{ day: "asc" }, { startTime: "asc" }] }));
}));
app.post("/api/events", wrap(async (req, res) => {
  const c = cleanEvent(req.body);
  if (c.error) return res.status(400).json({ error: c.error });
  res.json(await prisma.event.create({ data: c.data }));
}));
app.patch("/api/events/:id", wrap(async (req, res) => {
  const c = cleanEvent(req.body, true);
  if (c.error) return res.status(400).json({ error: c.error });
  const cur = await prisma.event.findUnique({ where: { id: id(req) } });
  if (!cur) return res.status(404).json({ error: "Event not found." });
  const st = c.data.startTime ?? cur.startTime, en = c.data.endTime ?? cur.endTime;
  if (!c.data.allDay && st && en && toMin(en) <= toMin(st)) return res.status(400).json({ error: "The end must be after the start." });
  res.json(await prisma.event.update({ where: { id: cur.id }, data: c.data }));
}));
// "delete only this day" for a repeating event
app.post("/api/events/:id/skip", wrap(async (req, res) => {
  const cur = await prisma.event.findUnique({ where: { id: id(req) } });
  if (!cur) return res.status(404).json({ error: "Event not found." });
  if (!DAY_RE.test(req.body.day || "")) return res.status(400).json({ error: "Pick a valid date." });
  const list = new Set((cur.exceptions || "").split(",").filter(Boolean));
  list.add(req.body.day);
  res.json(await prisma.event.update({ where: { id: cur.id }, data: { exceptions: [...list].sort().join(",") } }));
}));
app.delete("/api/events/:id", wrap(async (req, res) => {
  await prisma.event.delete({ where: { id: id(req) } });
  res.json({ ok: true });
}));

// everything the calendar shows for a date range, in one call
app.get("/api/calendar", wrap(async (req, res) => {
  const { from, to } = req.query;
  if (!DAY_RE.test(from || "") || !DAY_RE.test(to || "") || to < from) return res.status(400).json({ error: "Give a valid from and to date." });
  if ((new Date(to) - new Date(from)) / 86400000 > 100) return res.status(400).json({ error: "That range is too long." });
  res.json(await buildCalendar(prisma, from, to));
}));
app.get("/api/calendar.ics", wrap(async (_, res) => {
  res.set({ "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="thought-studio.ics"' });
  res.send(await buildIcs(prisma));
}));
app.post("/api/calendar/parse", wrap(async (req, res) => {
  if (!String(req.body.text || "").trim()) return res.status(400).json({ error: "Type what you want to add, like: study Friday 3pm for 1h." });
  res.json(await parseEventText(String(req.body.text).slice(0, 300)));
}));
app.post("/api/calendar/plan", wrap(async (_, res) => res.json(await planStudyBlocks(prisma))));

// ---------- Goals ----------
const goalInclude = { actions: { orderBy: { id: "asc" } }, logs: { orderBy: { createdAt: "desc" } } };
app.get("/api/goals", wrap(async (_, res) => {
  res.json(await prisma.goal.findMany({ include: goalInclude, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }));
}));
app.post("/api/goals", wrap(async (req, res) => {
  const { original, targetDate } = req.body;
  if (!original?.trim()) return res.status(400).json({ error: "Write your goal first." });
  const d = targetDate ? parseDate(targetDate) : null;
  if (targetDate && !d) return res.status(400).json({ error: "Invalid date." });
  res.json(await prisma.goal.create({ data: { original, targetDate: d }, include: goalInclude }));
}));
app.patch("/api/goals/:id", wrap(async (req, res) => {
  const { original, refined, status } = req.body;
  const data = { original, refined, status };
  if ("targetDate" in req.body) {
    data.targetDate = req.body.targetDate ? parseDate(req.body.targetDate) : null;
    if (req.body.targetDate && !data.targetDate) return res.status(400).json({ error: "Invalid date." });
  }
  const goal = await prisma.goal.update({ where: { id: id(req) }, data, include: goalInclude });
  if (status === "achieved") await award(prisma, `goal:${goal.id}`, "goal", XP.goal, `Reached a goal: ${(goal.refined || goal.original).slice(0, 80)}`);
  res.json(goal);
}));
app.delete("/api/goals/:id", wrap(async (req, res) => {
  await prisma.goal.delete({ where: { id: id(req) } });
  res.json({ ok: true });
}));
app.post("/api/goals/:id/analyze", wrap(async (req, res) => {
  const goal = await prisma.goal.findUnique({ where: { id: id(req) }, include: { actions: true } });
  if (!goal) return res.status(404).json({ error: "Goal not found" });
  const since = new Date(Date.now() - 14 * 86400000);
  const sessions = await prisma.studySession.findMany({ where: { endedAt: { not: null }, startedAt: { gte: since } } });
  const mins = sessions.reduce((a, s) => a + (s.endedAt - s.startedAt - s.breakMs) / 60000, 0);
  const out = await analyzeGoal({
    goal: goal.original,
    targetDate: goal.targetDate?.toISOString().slice(0, 10),
    today: new Date().toISOString().slice(0, 10),
    studyHours14d: (mins / 60).toFixed(1),
    existingActions: goal.actions.map((a) => a.text),
  });
  const saved = await prisma.goal.update({
    where: { id: goal.id },
    data: { refined: out.refined, verdict: out.verdict, verdictNote: out.verdictNote, suggestion: out.suggestion, analyzedAt: new Date() },
    include: goalInclude,
  });
  res.json({ goal: saved, actions: out.actions });
}));
app.post("/api/goals/:id/actions", wrap(async (req, res) => {
  const texts = (req.body.texts ?? [req.body.text]).filter((t) => t?.trim());
  await prisma.goalAction.createMany({ data: texts.map((text) => ({ text, goalId: id(req) })) });
  res.json(await prisma.goal.findUnique({ where: { id: id(req) }, include: goalInclude }));
}));
app.patch("/api/goal-actions/:id", wrap(async (req, res) => {
  const step = await prisma.goalAction.update({ where: { id: id(req) }, data: { done: req.body.done, text: req.body.text } });
  if (req.body.done === true) await award(prisma, `step:${step.id}`, "step", XP.step, `Goal step done: ${step.text}`);
  res.json(step);
}));
app.delete("/api/goal-actions/:id", wrap(async (req, res) => {
  await prisma.goalAction.delete({ where: { id: id(req) } });
  res.json({ ok: true });
}));
app.post("/api/goals/:id/logs", wrap(async (req, res) => {
  if (!req.body.text?.trim()) return res.status(400).json({ error: "Write what you did." });
  await prisma.goalLog.create({ data: { text: req.body.text, goalId: id(req) } });
  res.json(await prisma.goal.findUnique({ where: { id: id(req) }, include: goalInclude }));
}));
app.delete("/api/goal-logs/:id", wrap(async (req, res) => {
  await prisma.goalLog.delete({ where: { id: id(req) } });
  res.json({ ok: true });
}));

// ---------- AI ----------
app.post("/api/ai/rewrite", wrap(async (req, res) => {
  const { thought, draft, instruction } = req.body;
  if (!thought?.trim()) return res.status(400).json({ error: "No thought to rewrite." });
  res.json(await rewritePost({ thought, draft, instruction }));
}));
app.post("/api/ai/polish", wrap(async (req, res) => {
  const text = req.body.text ?? req.body.draft;
  if (!text?.trim()) return res.status(400).json({ error: "There is nothing to polish." });
  res.json(await polishDraft(text));
}));
app.post("/api/ai/steps", wrap(async (req, res) => res.json({ steps: await taskSteps(req.body.task) })));
app.post("/api/ai/organize", wrap(async (req, res) => res.json({ items: await organize(req.body.text) })));

registerMail(app, prisma, wrap, { demo: DEMO });
registerJobs(app, prisma, wrap);

// The demo serves the built website from this same server, so only ONE port ever needs to be shared.
if (DEMO) {
  const dist = fileURLToPath(new URL("../../web/dist/", import.meta.url));
  app.use((_, res, next) => { for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v); next(); });
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = process.env.PORT || 4000;
app.listen(port, "127.0.0.1", () => {
  console.log(`API on http://localhost:${port}${DEMO ? " (DEMO MODE)" : ""}`);
  if (DEMO) return; // no scheduler, reminders or automatic backups in the demo
  prisma.post
    .updateMany({ where: { status: "posting" }, data: { status: "failed", lastError: "The app stopped while this was being sent. Check your LinkedIn profile before posting it again, it may already be there." } })
    .then(runScheduler) // then catch up on anything that came due while the app was closed
    .catch((e) => console.error("Startup error:", e.message));
  startAutoBackup(prisma);
  const tick = () => checkReminders(prisma).catch((e) => console.error("Reminder check failed:", e.message));
  setTimeout(tick, 15000);
  setInterval(tick, 60000);
  const mine = () => checkMyReminders(prisma).catch((e) => console.error("My reminders check failed:", e.message));
  setTimeout(mine, 5000);
  setInterval(mine, 20000);
  setInterval(runScheduler, 30000);
});
