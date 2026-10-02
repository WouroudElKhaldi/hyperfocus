// The API's settings, read from environment variables (the project-root .env, or the real environment) and checked
// once at start-up. A wrong value stops the app with a message that says exactly what to fix, instead of failing later
// in the middle of a request. This file only parses: loading the .env file is the app's job (apps/api/src/config.ts).
import { z } from "zod";

/** Environment values as Node gives them: every value is a string or missing. */
export type Env = Record<string, string | undefined>;

// An empty or blank value counts as "not set", so `KEY=` in a .env file is the same as leaving the line out.
const text = z
  .string()
  .optional()
  .transform((v) => v?.trim() ?? "");
const url = (what: string) =>
  text.refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), { message: `${what} must be a web address starting with http:// or https://` });
// Any non-empty value switches a flag on (DEMO_MODE=1, DEMO_MODE=yes...), exactly as the app has always read it.
const flag = text.transform((v) => v !== "");

const schema = z.object({
  DATABASE_URL: text.refine((v) => v !== "", {
    message: 'DATABASE_URL is missing. For the local SQLite database use DATABASE_URL="file:./dev.db" (the path is relative to packages/db/prisma).',
  }),
  PORT: text.refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 65535), {
    message: "PORT must be a whole number between 1 and 65535, like 4000",
  }),
  DEMO_MODE: flag,
  NOTIFY_DRY_RUN: flag,
  DEEPSEEK_API_KEY: text,
  DEEPSEEK_URL: url("DEEPSEEK_URL"),
  DEEPSEEK_MODEL: text,
  N8N_WEBHOOK_URL: url("N8N_WEBHOOK_URL"),
  GOOGLE_BOOKS_API_KEY: text,
  GMAIL_USER: text.refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "GMAIL_USER must be your full Gmail address, like you@gmail.com" }),
  GMAIL_APP_KEY: text,
  SETTINGS_FILE: text,
  BACKUP_DIR: text,
});

/** The API's settings, already checked. Secrets are empty strings when not set (and always empty in the demo). */
export type ApiConfig = {
  databaseUrl: string;
  port: number;
  /** Showing the app to someone else: no AI, no posting, no email, no backups, no desktop notifications. */
  demo: boolean;
  /** Log notifications instead of showing them (tests, and always in the demo). */
  notifyDryRun: boolean;
  deepseek: { apiKey: string; url: string; model: string };
  n8nWebhookUrl: string;
  googleBooksApiKey: string;
  /** `appKey` is an App Password; the spaces Google shows in it are removed. */
  gmail: { user: string; appKey: string };
  /** Overrides for tests and other setups. Empty = the default place. */
  settingsFile: string;
  backupDir: string;
};

export type ConfigResult = { ok: true; config: ApiConfig } | { ok: false; problems: string[] };

/** Checks the environment. Never throws: a bad setup comes back as a list of problems, one line each. */
export function parseApiConfig(env: Env): ConfigResult {
  const r = schema.safeParse(env);
  if (!r.success) return { ok: false, problems: r.error.issues.map((i) => i.message) };
  const e = r.data;
  const demo = e.DEMO_MODE;
  return {
    ok: true,
    config: {
      databaseUrl: e.DATABASE_URL,
      port: e.PORT ? Number(e.PORT) : 4000,
      demo,
      notifyDryRun: demo || e.NOTIFY_DRY_RUN,
      // in the demo every secret is blanked, so nobody can spend someone else's credits or post as them
      deepseek: { apiKey: demo ? "" : e.DEEPSEEK_API_KEY, url: e.DEEPSEEK_URL || "https://api.deepseek.com/chat/completions", model: e.DEEPSEEK_MODEL || "deepseek-chat" },
      n8nWebhookUrl: demo ? "" : e.N8N_WEBHOOK_URL,
      googleBooksApiKey: demo ? "" : e.GOOGLE_BOOKS_API_KEY,
      gmail: { user: e.GMAIL_USER, appKey: demo ? "" : e.GMAIL_APP_KEY.replace(/\s+/g, "") },
      settingsFile: e.SETTINGS_FILE,
      backupDir: e.BACKUP_DIR,
    },
  };
}

/** The message shown when the app refuses to start. */
export const configErrorMessage = (problems: string[], where: string) =>
  [`Hyperfocus can't start: ${problems.length === 1 ? "a setting needs" : `${problems.length} settings need`} fixing in ${where}`, ...problems.map((p) => `  - ${p}`)].join("\n");
