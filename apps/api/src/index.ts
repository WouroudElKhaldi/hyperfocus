import { config } from "./config.ts"; // first: loads and checks the settings, and stops the app if they are wrong
import { SECURITY_HEADERS } from "../../web/security-headers.mjs";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@hyperfocus/db";
import { EventBus } from "./events.ts";
import { petEarnsXp } from "./modules/pet/xp.ts";
import { checkReminders, checkMyReminders } from "./reminders.ts";
import { startAutoBackup } from "./backup.ts";
import { registerMail } from "./mail.ts";
import { registerJobs } from "./jobs.ts";
import { createApp } from "./app.ts";
import { n8nPublisher } from "./modules/posts/publisher.ts";
import { failInterrupted, postScheduler } from "./modules/posts/scheduler.ts";
import { honoFirst } from "./http/strangler.ts";
import { log } from "./log.ts";
import { errorInfo, type Wrap } from "./types.ts";
import { ai } from "./ai.ts";

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

// Notes moved to Hono: src/modules/notes (P2-06)

// Tasks and steps moved to Hono: src/modules/tasks (P2-07)

// Posts, their scheduler and the AI helpers for posts moved to Hono: src/modules/posts (P2-15)

// The study log and timer moved to Hono: src/modules/study (P2-10)

// Settings and the test notification moved to Hono: src/modules/settings (P2-20)

// The stuck helper, task steps and sorting a brain dump moved to Hono: src/modules/coach (P2-18)

// The weekly review moved to Hono: src/modules/reviews (P2-14)

// The skills gap map moved to Hono: src/modules/skills (P2-09)

// The profile moved to Hono: src/modules/profile (P2-20)

// The companion pet moved to Hono: src/modules/pet (P2-19)

// My reminders moved to Hono: src/modules/reminders (P2-13)

// The support chat moved to Hono: src/modules/chat (P2-18)

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
