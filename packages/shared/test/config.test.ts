import { describe, expect, it } from "vitest";
import { type ApiConfig, configErrorMessage, parseApiConfig } from "../src/config.ts";

// The settings check the API runs at start-up (apps/api/src/config.ts). Defaults and the demo rules must match what the
// app did before P1-10, so nothing changes for a working setup.

const DB = "file:./dev.db";
const ok = (env: Record<string, string | undefined>): ApiConfig => {
  const r = parseApiConfig(env);
  if (!r.ok) throw new Error(`expected valid settings, got: ${r.problems.join("; ")}`);
  return r.config;
};
const problems = (env: Record<string, string | undefined>) => {
  const r = parseApiConfig(env);
  return r.ok ? [] : r.problems;
};

describe("API settings", () => {
  it("only the database is required; everything else has the old defaults", () => {
    expect(ok({ DATABASE_URL: DB })).toMatchObject({ // (settings added later have their own tests)
      databaseUrl: DB,
      port: 4000,
      demo: false,
      notifyDryRun: false,
      deepseek: { apiKey: "", url: "https://api.deepseek.com/chat/completions", model: "deepseek-chat" },
      n8nWebhookUrl: "",
      googleBooksApiKey: "",
      bookSourcesUrl: "",
      gmail: { user: "", appKey: "" },
      settingsFile: "",
      backupDir: "",
      logLevel: "info",
      corsOrigins: [],
      rateLimit: { perMinute: 600, aiPerMinute: 30 },
    });
  });

  // P2-23
  it("reads CORS origins and rate limits, and refuses wrong ones", () => {
    const c = ok({ DATABASE_URL: DB, CORS_ORIGINS: " https://app.example.com , http://localhost:5173 ", RATE_LIMIT_PER_MINUTE: "100", AI_RATE_LIMIT_PER_MINUTE: "5" });
    expect(c.corsOrigins).toEqual(["https://app.example.com", "http://localhost:5173"]);
    expect(c.rateLimit).toEqual({ perMinute: 100, aiPerMinute: 5 });
    expect(problems({ DATABASE_URL: DB, CORS_ORIGINS: "https://app.example.com/path" })).toEqual([expect.stringMatching(/^CORS_ORIGINS must be web origins/)]);
    expect(problems({ DATABASE_URL: DB, RATE_LIMIT_PER_MINUTE: "0" })).toEqual([expect.stringMatching(/^RATE_LIMIT_PER_MINUTE must be a whole number/)]);
    expect(problems({ DATABASE_URL: DB, AI_RATE_LIMIT_PER_MINUTE: "lots" })).toEqual([expect.stringMatching(/^AI_RATE_LIMIT_PER_MINUTE/)]);
  });

  it("refuses to start without a database, and says how to fix it", () => {
    expect(problems({})).toEqual([expect.stringContaining("DATABASE_URL is missing")]);
    expect(problems({ DATABASE_URL: "   " })).toEqual([expect.stringContaining("DATABASE_URL is missing")]);
  });

  it("lists every problem at once, one line each", () => {
    const p = problems({ PORT: "abc", N8N_WEBHOOK_URL: "localhost:5678/webhook", GMAIL_USER: "me" });
    expect(p).toHaveLength(4);
    const msg = configErrorMessage(p, "the .env file");
    expect(msg).toMatch(/^Hyperfocus can't start: 4 settings need fixing in the \.env file\n {2}- /);
    expect(msg).toContain("PORT must be a whole number");
    expect(msg).toContain("N8N_WEBHOOK_URL must be a web address");
    expect(msg).toContain("GMAIL_USER must be your full Gmail address");
  });

  it("checks the port", () => {
    expect(ok({ DATABASE_URL: DB, PORT: "4310" }).port).toBe(4310);
    for (const bad of ["0", "70000", "40.5", "-1", "4000x"]) expect(problems({ DATABASE_URL: DB, PORT: bad })).toHaveLength(1);
  });

  it("treats empty and blank values as not set (the test harness relies on a single space)", () => {
    const c = ok({ DATABASE_URL: DB, PORT: "", GMAIL_USER: " ", GMAIL_APP_KEY: " ", GOOGLE_BOOKS_API_KEY: " ", N8N_WEBHOOK_URL: "" });
    expect(c.port).toBe(4000);
    expect(c.gmail).toEqual({ user: "", appKey: "" });
    expect(c.googleBooksApiKey).toBe("");
  });

  it("cleans the Gmail settings like the mail module did", () => {
    expect(ok({ DATABASE_URL: DB, GMAIL_USER: " me@gmail.com ", GMAIL_APP_KEY: "abcd efgh ijkl mnop" }).gmail).toEqual({ user: "me@gmail.com", appKey: "abcdefghijklmnop" });
  });

  it("any non-empty DEMO_MODE switches the demo on, and the demo never sees a secret", () => {
    const c = ok({ DATABASE_URL: DB, DEMO_MODE: "1", DEEPSEEK_API_KEY: "sk-x", N8N_WEBHOOK_URL: "http://n8n/hook", GOOGLE_BOOKS_API_KEY: "g", GMAIL_USER: "me@gmail.com", GMAIL_APP_KEY: "k" });
    expect(c.demo).toBe(true);
    expect(c.notifyDryRun).toBe(true);
    expect(c.deepseek.apiKey).toBe("");
    expect(c.n8nWebhookUrl).toBe("");
    expect(c.googleBooksApiKey).toBe("");
    expect(c.gmail.appKey).toBe("");
    expect(ok({ DATABASE_URL: DB, DEMO_MODE: "" }).demo).toBe(false);
  });

  it("keeps the test overrides", () => {
    const c = ok({ DATABASE_URL: DB, DEEPSEEK_URL: "http://127.0.0.1:5555/chat/completions", NOTIFY_DRY_RUN: "1", SETTINGS_FILE: "/tmp/s.json", BACKUP_DIR: "/tmp/b" });
    expect(c.deepseek.url).toBe("http://127.0.0.1:5555/chat/completions");
    expect(c.notifyDryRun).toBe(true);
    expect([c.settingsFile, c.backupDir]).toEqual(["/tmp/s.json", "/tmp/b"]);
  });

  it("checks the log level", () => {
    expect(ok({ DATABASE_URL: DB, LOG_LEVEL: "debug" }).logLevel).toBe("debug");
    expect(problems({ DATABASE_URL: DB, LOG_LEVEL: "loud" })).toEqual([expect.stringContaining("LOG_LEVEL must be one of")]);
  });

  it("ignores settings it doesn't know (like GMAIL_APP_NAME)", () => {
    expect(parseApiConfig({ DATABASE_URL: DB, GMAIL_APP_NAME: "anything", SOMETHING_ELSE: "x" }).ok).toBe(true);
  });
});
