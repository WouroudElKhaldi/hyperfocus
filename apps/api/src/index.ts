import { config } from "./config.ts"; // first: loads and checks the settings, and stops the app if they are wrong
import { SECURITY_HEADERS } from "../../web/security-headers.mjs";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type ChatThread, PrismaClient } from "@hyperfocus/db";
import type { Request } from "express";
import { EventBus } from "./events.ts";
import { petEarnsXp } from "./modules/pet/xp.ts";
import { companionReply, isCrisis } from "./chat.ts";
import type { AiMessage } from "./ai.ts";
import { checkReminders, checkMyReminders } from "./reminders.ts";
import { startAutoBackup } from "./backup.ts";
import { registerMail } from "./mail.ts";
import { registerJobs } from "./jobs.ts";
import { createApp } from "./app.ts";
import { n8nPublisher } from "./modules/posts/publisher.ts";
import { failInterrupted, postScheduler } from "./modules/posts/scheduler.ts";
import { honoFirst } from "./http/strangler.ts";
import { log } from "./log.ts";
import { activeMs, errorInfo, type UncheckedJson, type Wrap } from "./types.ts";
import { ai, taskSteps, organize, stuckHelp } from "./ai.ts";

// DEMO_MODE is for showing the app to someone else. config.ts blanks every secret in the demo, and they are also removed
// from the environment so nothing can ever read them.
const DEMO = config.demo;
const prisma = new PrismaClient({ datasourceUrl: config.databaseUrl });
if (DEMO) for (const k of ["DEEPSEEK_API_KEY", "N8N_WEBHOOK_URL", "GOOGLE_BOOKS_API_KEY", "GMAIL_APP_KEY"]) delete process.env[k];
// Where finished posts go: LinkedIn through the n8n webhook (empty in the demo, so nothing can be posted).
const publisher = n8nPublisher(config.n8nWebhookUrl);
// Domain events (P2-04): routes say what happened, subscribers react. The pet earns its XP this way.
const events = new EventBus((event, err) => log.error({ err, event }, "an event subscriber failed"));
petEarnsXp(events, prisma);
const app = express();
app.use(cors({ origin: /^http:\/\/(localhost|127\.0\.0\.1):\d+$/ }));
// The new Hono app answers the routes it already has; Express answers the rest (P2-01, the strangler). It must come before
// express.json(), so the requests Express answers still have an unread body.
app.use(honoFirst(createApp({ config, prisma, log, events, ai, publisher })));
app.use(express.json({ limit: "1mb" }));

// The demo switch for the routes Express still answers (email, until P2-16). Hono has its own (app.ts).
if (DEMO) app.use(["/api/emails", "/api/email-templates"], (_, res) => res.status(403).json({ error: "This is switched off in the demo." }));

// TODO(types): request bodies (req.body) are unchecked until each module moves to Hono with Zod schemas (P2).
const wrap: Wrap = (fn) => (req, res) => {
  fn(req, res).catch((thrown: unknown) => {
    const e = errorInfo(thrown);
    console.error(e.message);
    res.status(e.status || 500).json({ error: e.message });
  });
};
const id = (req: Request) => Number(req.params.id);

// Notes moved to Hono: src/modules/notes (P2-06)

// Tasks and steps moved to Hono: src/modules/tasks (P2-07)

// Posts, their scheduler and the AI helpers for posts moved to Hono: src/modules/posts (P2-15)

// The study log and timer moved to Hono: src/modules/study (P2-10)

// Settings and the test notification moved to Hono: src/modules/settings (P2-20)

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

// The weekly review moved to Hono: src/modules/reviews (P2-14)

// The skills gap map moved to Hono: src/modules/skills (P2-09)

// The profile moved to Hono: src/modules/profile (P2-20)

// The companion pet moved to Hono: src/modules/pet (P2-19)

// My reminders moved to Hono: src/modules/reminders (P2-13)

// ---------- Support chat ----------
// Conversations are saved as threads. A "temporary" chat is sent with its own history and is never written to the database.
const threadTitle = (text: unknown) => { const t = String(text).replace(/\s+/g, " ").trim(); return t.length > 44 ? t.slice(0, 41).trimEnd() + "..." : t || "New chat"; };
async function adoptOldMessages() { // messages from before threads existed become one earlier conversation
  const old = await prisma.chatMessage.findMany({ where: { threadId: null }, orderBy: { id: "asc" } });
  const oldest = old[0], newest = old.at(-1);
  if (!oldest || !newest) return;
  const first = old.find((m) => m.role === "user");
  const th = await prisma.chatThread.create({ data: { title: first ? threadTitle(first.content) : "Earlier chat", createdAt: oldest.createdAt, updatedAt: newest.createdAt } });
  await prisma.chatMessage.updateMany({ where: { threadId: null }, data: { threadId: th.id } });
}
app.get("/api/chat/threads", wrap(async (_, res) => {
  await adoptOldMessages();
  const rows = await prisma.chatThread.findMany({ orderBy: [{ updatedAt: "desc" }, { id: "desc" }], include: { _count: { select: { messages: true } } } });
  res.json(rows.map((t) => ({ id: t.id, title: t.title, updatedAt: t.updatedAt, createdAt: t.createdAt, count: t._count.messages })));
}));
app.post("/api/chat/threads", wrap(async (_, res) => res.json(await prisma.chatThread.create({ data: {} }))));
app.get("/api/chat/threads/:id", wrap(async (req, res) => {
  const t = await prisma.chatThread.findUnique({ where: { id: id(req) } });
  if (!t) return res.status(404).json({ error: "That chat was not found." });
  res.json({ thread: t, messages: await prisma.chatMessage.findMany({ where: { threadId: t.id }, orderBy: { id: "asc" } }) });
}));
app.patch("/api/chat/threads/:id", wrap(async (req, res) => {
  const title = String(req.body.title || "").trim().slice(0, 80);
  if (!title) return res.status(400).json({ error: "Give the chat a name." });
  res.json(await prisma.chatThread.update({ where: { id: id(req) }, data: { title } }));
}));
app.delete("/api/chat/threads/:id", wrap(async (req, res) => {
  await prisma.chatMessage.deleteMany({ where: { threadId: id(req) } });
  await prisma.chatThread.deleteMany({ where: { id: id(req) } });
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
  let thread: ChatThread | null = null;
  let history: AiMessage[];
  if (temporary) {
    history = ((Array.isArray(req.body.history) ? req.body.history : []) as UncheckedJson[]).filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string").slice(-24).map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
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
  const studied = Math.round(today.reduce((t, x) => t + activeMs(x) / 60000, 0));
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

// Backups moved to Hono: src/modules/backups (P2-20)

// Books moved to Hono: src/modules/books (P2-11)

// The calendar moved to Hono: src/modules/calendar (P2-12)

// Goals, their actions and logs moved to Hono: src/modules/goals (P2-08)

// ---------- AI ----------
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

const port = config.port;
app.listen(port, "127.0.0.1", () => {
  console.log(`API on http://localhost:${port}${DEMO ? " (DEMO MODE)" : ""}`);
  if (DEMO) return; // no scheduler, reminders or automatic backups in the demo
  const runScheduler = postScheduler({ prisma, publisher, events });
  failInterrupted(prisma)
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
