import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { startFakeS3 } from "../support/fake-s3.js";
import { freePort } from "../support/stack.js";

// P4-07 acceptance: "attachments survive redeploys". An API process stores a file and is stopped; a brand-new process
// (a redeploy) serves the very same bytes. Done with the folder and with S3-compatible storage, on this run's database.

const SERVER_DIR = fileURLToPath(new URL("../../", import.meta.url));
const bytes = Buffer.from([0, 1, 2, 3, 250, 251, 252, 255]);

async function startApi(extraEnv, name) {
  const port = await freePort();
  const log = path.join(inject("tmpDir"), `${name}.log`);
  const out = fs.openSync(log, "a");
  const child = spawn(process.execPath, ["src/index.ts"], {
    cwd: SERVER_DIR,
    stdio: ["ignore", out, out],
    env: {
      ...process.env, DATABASE_URL: inject("databaseUrl"), PORT: String(port), NOTIFY_DRY_RUN: "1",
      SETTINGS_FILE: path.join(inject("tmpDir"), "settings.json"), BACKUP_DIR: path.join(inject("tmpDir"), "backups"),
      GMAIL_USER: " ", GMAIL_APP_KEY: " ", DEEPSEEK_API_KEY: "test-key", RATE_LIMIT_PER_MINUTE: "1000000", ...extraEnv,
    },
  });
  const url = `http://127.0.0.1:${port}`;
  for (const end = Date.now() + 60000; Date.now() < end; ) {
    try { if ((await fetch(`${url}/api/health`)).ok) break; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  const stop = async () => { if (child.exitCode === null) { child.kill(); await new Promise((r) => child.once("exit", r)); } };
  return { url, stop };
}

// upload with one process, then stop it; a fresh process must serve the same bytes
async function survivesRedeploy(env) {
  const first = await startApi(env, `files-1-${env.FILE_STORAGE}`);
  const email = await (await fetch(`${first.url}/api/emails`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).json();
  const up = await fetch(`${first.url}/api/emails/${email.id}/attachments?name=data.bin`, { method: "POST", headers: { "Content-Type": "application/octet-stream", "x-file-type": "application/octet-stream" }, body: bytes });
  const file = await up.json();
  await first.stop();
  const second = await startApi(env, `files-2-${env.FILE_STORAGE}`);
  try {
    const down = await fetch(`${second.url}/api/emails/attachments/${file.id}`);
    return { email, file, status: down.status, body: Buffer.from(await down.arrayBuffer()), second };
  } catch (e) {
    await second.stop();
    throw e;
  }
}

describe("files survive a redeploy (P4-07)", { timeout: 120000 }, () => {
  let s3;
  beforeAll(async () => { s3 = await startFakeS3(); });
  afterAll(() => s3?.close());

  it("in a folder (FILE_STORAGE=disk): same bytes after a restart; deleting the email deletes the file", async () => {
    const dir = path.join(inject("tmpDir"), "stored-files");
    const r = await survivesRedeploy({ FILE_STORAGE: "disk", FILE_STORAGE_DIR: dir });
    try {
      expect(r.status).toBe(200);
      expect([...r.body]).toEqual([...bytes]);
      expect(fs.readdirSync(dir)).toHaveLength(1); // only the key in the folder, the database row has no bytes
      await fetch(`${r.second.url}/api/emails/${r.email.id}`, { method: "DELETE" });
      expect(fs.readdirSync(dir)).toHaveLength(0);
    } finally { await r.second.stop(); }
  });

  it("in S3-compatible storage (FILE_STORAGE=s3): same bytes after a restart; deleting the email deletes the object", async () => {
    const r = await survivesRedeploy({ FILE_STORAGE: "s3", S3_ENDPOINT: s3.url, S3_BUCKET: "hf-files", S3_ACCESS_KEY_ID: "test-key", S3_SECRET_ACCESS_KEY: "secret" });
    try {
      expect(r.status).toBe(200);
      expect([...r.body]).toEqual([...bytes]);
      expect(s3.objects.size).toBe(1);
      await fetch(`${r.second.url}/api/emails/${r.email.id}`, { method: "DELETE" });
      expect(s3.objects.size).toBe(0);
    } finally { await r.second.stop(); }
  });
});
