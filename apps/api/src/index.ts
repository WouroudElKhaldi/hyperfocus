import { config } from "./config.ts"; // first: loads and checks the settings, and stops the app if they are wrong
import { serve } from "@hono/node-server";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@hyperfocus/db";
import { EventBus } from "./events.ts";
import { petEarnsXp } from "./modules/pet/xp.ts";
import { gmailAppPassword } from "./modules/emails/mail-provider.ts";
import { createApp } from "./app.ts";
import { fileStorageFrom } from "./storage/files.ts";
import { n8nPublisher } from "./modules/posts/publisher.ts";
import { backgroundJobs } from "./jobs/index.ts";
import { pgBossScheduler } from "./jobs/pgboss.ts";
import { createServer } from "./server.ts";
import { log } from "./log.ts";
import { ai } from "./ai.ts";

// DEMO_MODE is for showing the app to someone else. config.ts blanks every secret in the demo, and they are also removed
// from the environment so nothing can ever read them.
const DEMO = config.demo;
const prisma = new PrismaClient({ datasourceUrl: config.databaseUrl });
if (DEMO) for (const k of ["DEEPSEEK_API_KEY", "N8N_WEBHOOK_URL", "GOOGLE_BOOKS_API_KEY", "GMAIL_APP_KEY"]) delete process.env[k];
// Where finished posts go: LinkedIn through the n8n webhook (empty in the demo, so nothing can be posted).
const publisher = n8nPublisher(config.n8nWebhookUrl);
// Sending email: her Gmail with an App Password (switched off in the demo).
const mail = gmailAppPassword(config.gmail, { demo: DEMO });
// Domain events (P2-04): routes say what happened, subscribers react. The pet earns its XP this way.
const events = new EventBus((event, err) => log.error({ err, event }, "an event subscriber failed"));
petEarnsXp(events, prisma);
// The whole HTTP server is Hono (P2-22): the API, plus the built website in the demo.
// Uploaded files: inside the database unless FILE_STORAGE says a folder or S3-compatible storage (P4-07).
// (the default folder is <project>/storage, next to backups)
const files = fileStorageFrom({ ...config.fileStorage, dir: config.fileStorage.dir || fileURLToPath(new URL("../../../storage/", import.meta.url)) });
const server = createServer(createApp({ config, prisma, log, events, ai, publisher, mail, files }), {
  demo: DEMO,
  corsOrigins: config.corsOrigins,
  webDist: fileURLToPath(new URL("../../web/dist/", import.meta.url)),
});

const port = config.port;
serve({ fetch: server.fetch, port, hostname: "127.0.0.1" }, () => {
  console.log(`API on http://localhost:${port}${DEMO ? " (DEMO MODE)" : ""}`);
  if (DEMO) return; // no scheduler, reminders or automatic backups in the demo
  // a queue in PostgreSQL (P4-05), so the jobs run once even with several copies of the API
  const scheduler = pgBossScheduler({ databaseUrl: config.databaseUrl, log });
  for (const job of backgroundJobs({ prisma, publisher, events })) scheduler.add(job);
  scheduler.start();
});
