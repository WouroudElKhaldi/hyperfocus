import { config } from "./config.ts"; // first: loads and checks the settings, and stops the app if they are wrong
import { serve } from "@hono/node-server";
import { fileURLToPath } from "node:url";
import { OWNER_OMIT, PrismaClient } from "@hyperfocus/db";
import { EventBus } from "./events.ts";
import { petEarnsXp } from "./modules/pet/xp.ts";
import { gmailAppPassword, personalMail } from "./modules/emails/mail-provider.ts";
import { createApp } from "./app.ts";
import { tenancy } from "./tenancy.ts";
import type { Db } from "./types.ts";
import { authMailer, createAuth } from "./auth.ts";
import { fileStorageFrom } from "./storage/files.ts";
import { keyRing, localKeyRing } from "./secrets.ts";
import { tokenUrl } from "./google-oauth.ts";
import { pushChannel, vapidFrom } from "./push.ts";
import { n8nPublisher, personalPublisher } from "./modules/posts/publisher.ts";
import { backgroundJobs } from "./jobs/index.ts";
import { pgBossScheduler } from "./jobs/pgboss.ts";
import { createServer } from "./server.ts";
import { log } from "./log.ts";
import { ai as sharedAi, aiReady } from "./ai.ts";
import { limitedAi } from "./ai-quota.ts";

// DEMO_MODE is for showing the app to someone else. config.ts blanks every secret in the demo, and they are also removed
// from the environment so nothing can ever read them.
const DEMO = config.demo;
// no row's owner id in any answer (P5-02), and every query scoped to the person asking (P5-03, the tenancy guard).
// (the guard only adds conditions to queries, so the client keeps its type)
const prisma = new PrismaClient({ datasourceUrl: config.databaseUrl, omit: OWNER_OMIT }).$extends(tenancy) as unknown as Db;
if (DEMO) for (const k of ["DEEPSEEK_API_KEY", "N8N_WEBHOOK_URL", "GOOGLE_BOOKS_API_KEY", "GMAIL_APP_KEY"]) delete process.env[k];
// Where finished posts go: LinkedIn through the n8n webhook (empty in the demo, so nothing can be posted).
// (each person's own webhook from Settings → Connections; the .env one only in local mode, P5-07)
const publisher = DEMO ? n8nPublisher("") : personalPublisher(config.mode === "local" ? config.n8nWebhookUrl : "");
// Sending email: her Gmail with an App Password (switched off in the demo).
// (each person's own Gmail from Settings → Connections; the .env one only in local mode, P5-07). The account emails
// (confirm, reset) are the app's own: always the .env Gmail.
const appMail = gmailAppPassword(config.gmail, { demo: DEMO });
const google = config.auth.google ? { ...config.auth.google, tokenUrl: tokenUrl({ baseUrl: config.googleOAuthUrl }) } : null; // P5-08
const mail = personalMail(config.mode === "local" ? config.gmail : { user: "", appKey: "" }, { demo: DEMO, google, smtp: config.gmailSmtp });
// Domain events (P2-04): routes say what happened, subscribers react. The pet earns its XP this way.
const events = new EventBus((event, err) => log.error({ err, event }, "an event subscriber failed"));
petEarnsXp(events, prisma);
// The whole HTTP server is Hono (P2-22): the API, plus the built website in the demo.
// Uploaded files: inside the database unless FILE_STORAGE says a folder or S3-compatible storage (P4-07).
// (the default folder is <project>/storage, next to backups)
const files = fileStorageFrom({ ...config.fileStorage, dir: config.fileStorage.dir || fileURLToPath(new URL("../../../storage/", import.meta.url)) });
// Accounts (P5-01): cloud mode only; local mode has one owner and nobody signs in.
const auth = config.mode === "cloud" ? createAuth({ prisma, config, send: authMailer({ mail: appMail, log, dryRun: config.mailDryRun }) }) : null;
// The key that seals each person's tokens (P5-07): SECRETS_KEYS, or in local mode a key file made once next to the API.
const secrets = config.secretsKeys ? keyRing(config.secretsKeys) : localKeyRing(fileURLToPath(new URL("../secrets.key", import.meta.url)));
// AI daily limits on the app's own key (P5-10)
const ai = limitedAi(sharedAi, prisma, config.aiDailyLimit);
// Web push keys (P5-11): from the settings, or in local mode a pair made once next to the API
const vapid = DEMO ? null : vapidFrom(config.vapid, config.mode === "local" ? fileURLToPath(new URL("../vapid.json", import.meta.url)) : null);
const push = vapid ? pushChannel(prisma, vapid) : null;
const server = createServer(createApp({ config, prisma, log, events, ai, aiReady, publisher, mail, files, auth, secrets, vapid, push }), {
  demo: DEMO,
  corsOrigins: config.corsOrigins,
  webDist: fileURLToPath(new URL("../../web/dist/", import.meta.url)),
});

const port = config.port;
serve({ fetch: server.fetch, port, hostname: "127.0.0.1" }, () => {
  console.log(`API on http://localhost:${port}${DEMO ? " (DEMO MODE)" : ""}`);
  if (DEMO) return; // no scheduler, reminders or automatic backups in the demo
  if (config.noBackgroundJobs) return; // NO_BACKGROUND_JOBS: this copy only answers requests
  // a queue in PostgreSQL (P4-05), so the jobs run once even with several copies of the API
  const scheduler = pgBossScheduler({ databaseUrl: config.databaseUrl, log });
  for (const job of backgroundJobs({ prisma, publisher, events, secrets, mode: config.mode, push })) scheduler.add(job);
  scheduler.start();
});
