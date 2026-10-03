// Starts the safe test API (throwaway database, fake AI and n8n, no Gmail) for the browser tests.
// Playwright runs this as a web server and stops it when the tests end.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startTestStack } from "../apps/api/test/support/stack.js";

const port = Number(process.env.E2E_API_PORT || 4310);
// E2E_CLOUD=1: the cloud-mode stack (P5-04: people sign up and in). Its account emails go to the log, and where that log is
// goes in a small file the account tests read.
const cloud = process.env.E2E_CLOUD === "1";
const stack = await startTestStack({
  port,
  env: cloud ? { APP_MODE: "cloud", BETTER_AUTH_SECRET: "e2e-secret-that-is-long-enough-1234567890", PUBLIC_URL: process.env.E2E_PUBLIC_URL ?? "", MAIL_DRY_RUN: "1" } : {},
});
// a small taxonomy (jobs, skills, majors, places) so the Job Radar pages have something to show (P6)
const { seedTaxonomy } = await import("../apps/api/test/support/taxonomy-fixture.js");
await seedTaxonomy(stack.databaseUrl);
// and a few job postings for Job Radar (P6-27)
const { seedPostings } = await import("../apps/api/test/support/radar-fixture.js");
await seedPostings(stack.databaseUrl);
if (cloud) fs.writeFileSync(path.join(os.tmpdir(), "hyperfocus-e2e-cloud.json"), JSON.stringify({ log: path.join(stack.tmpDir, "api.log") }));
console.log(`Test API on ${stack.apiUrl} (data in ${stack.tmpDir})`);

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await stack.stop().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.stdin.on("end", stop);
process.stdin.resume();
