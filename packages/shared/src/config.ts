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
const perMinute = (what: string) => text.refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 1), { message: `${what} must be a whole number of requests per minute, like 60` });
// a comma-separated list of web origins (scheme, host and port, no path)
const origins = text.refine((v) => v.split(",").every((o) => !o.trim() || /^https?:\/\/[^/\s]+$/.test(o.trim())), {
  message: "CORS_ORIGINS must be web origins separated by commas, like https://app.example.com,http://localhost:5173",
});

/** How much the API logs. "info" logs one line per request handled by the new (Hono) routes. */
export const LOG_LEVELS = ["silent", "error", "warn", "info", "debug"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const schema = z.object({
  DATABASE_URL: text.refine((v) => v !== "", {
    message: 'DATABASE_URL is missing. For the local PostgreSQL (made by pnpm db:setup) use DATABASE_URL="postgresql://hyperfocus:hyperfocus-local@localhost:5432/hyperfocus".',
  }),
  PORT: text.refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 65535), {
    message: "PORT must be a whole number between 1 and 65535, like 4000",
  }),
  DEMO_MODE: flag,
  NOTIFY_DRY_RUN: flag,
  NO_BACKGROUND_JOBS: flag,
  APP_MODE: text.refine((v) => ["", "local", "cloud"].includes(v), { message: "APP_MODE must be local (just you, on this computer) or cloud (sign-in, several people)" }),
  BETTER_AUTH_SECRET: text,
  PUBLIC_URL: url("PUBLIC_URL"),
  GOOGLE_CLIENT_ID: text,
  GOOGLE_CLIENT_SECRET: text,
  MAIL_DRY_RUN: flag,
  DEEPSEEK_API_KEY: text,
  DEEPSEEK_URL: url("DEEPSEEK_URL"),
  DEEPSEEK_MODEL: text,
  N8N_WEBHOOK_URL: url("N8N_WEBHOOK_URL"),
  GOOGLE_BOOKS_API_KEY: text,
  BOOK_SOURCES_URL: url("BOOK_SOURCES_URL"),
  GMAIL_USER: text.refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "GMAIL_USER must be your full Gmail address, like you@gmail.com" }),
  GMAIL_APP_KEY: text,
  SETTINGS_FILE: text,
  BACKUP_DIR: text,
  CORS_ORIGINS: origins,
  RATE_LIMIT_PER_MINUTE: perMinute("RATE_LIMIT_PER_MINUTE"),
  AI_RATE_LIMIT_PER_MINUTE: perMinute("AI_RATE_LIMIT_PER_MINUTE"),
  FILE_STORAGE: text.refine((v) => ["", "database", "disk", "s3"].includes(v), { message: "FILE_STORAGE must be database, disk or s3" }),
  FILE_STORAGE_DIR: text,
  S3_ENDPOINT: url("S3_ENDPOINT"),
  S3_BUCKET: text,
  S3_ACCESS_KEY_ID: text,
  S3_SECRET_ACCESS_KEY: text,
  S3_REGION: text,
  LOG_LEVEL: text.refine((v) => v === "" || LOG_LEVELS.includes(v as LogLevel), { message: `LOG_LEVEL must be one of: ${LOG_LEVELS.join(", ")}` }),
}).refine((e) => e.APP_MODE !== "cloud" || e.BETTER_AUTH_SECRET.length >= 32, {
  message: "APP_MODE=cloud needs BETTER_AUTH_SECRET: a random secret of at least 32 characters (for example from: openssl rand -base64 32)",
}).refine((e) => !e.GOOGLE_CLIENT_ID === !e.GOOGLE_CLIENT_SECRET, {
  message: "Google sign-in needs both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (or neither)",
}).refine((e) => e.FILE_STORAGE !== "s3" || (e.S3_ENDPOINT && e.S3_BUCKET && e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY), {
  message: "FILE_STORAGE=s3 needs S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY",
});

/** The API's settings, already checked. Secrets are empty strings when not set (and always empty in the demo). */
export type ApiConfig = {
  databaseUrl: string;
  port: number;
  /** Showing the app to someone else: no AI, no posting, no email, no backups, no desktop notifications. */
  demo: boolean;
  /** Log notifications instead of showing them (tests, and always in the demo). */
  notifyDryRun: boolean;
  /** This copy answers requests only; another copy runs the reminders, the post scheduler and backups (P4-08). */
  noBackgroundJobs: boolean;
  /**
   * local (default, APP_MODE): just you, on this computer: one owner account, nobody signs in (works like before accounts existed).
   * cloud: people sign up and sign in (email + password with verification and reset, and Google when its keys are set).
   */
  mode: "local" | "cloud";
  auth: { secret: string; publicUrl: string; google: { clientId: string; clientSecret: string } | null };
  /** Write the emails the app sends for accounts (verify, reset) to the log instead of sending them (tests). */
  mailDryRun: boolean;
  deepseek: { apiKey: string; url: string; model: string };
  n8nWebhookUrl: string;
  googleBooksApiKey: string;
  /** Tests only: one address that stands in for Open Library, Google Books and Gutenberg. Empty = the real sites. */
  bookSourcesUrl: string;
  /** `appKey` is an App Password; the spaces Google shows in it are removed. */
  gmail: { user: string; appKey: string };
  /** Overrides for tests and other setups. Empty = the default place. */
  settingsFile: string;
  backupDir: string;
  logLevel: LogLevel;
  /** Web pages (origins) allowed to call the API from another address. Empty = pages on this computer only. */
  corsOrigins: string[];
  /** Requests per minute per visitor, for all routes and for the routes that call the AI (each costs credits). */
  rateLimit: { perMinute: number; aiPerMinute: number };
  /** Where uploaded files' bytes go (P4-07): inside the database (default), a folder, or S3-compatible storage. */
  fileStorage: { kind: "database" | "disk" | "s3"; dir: string; s3: { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string; region: string } };
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
      noBackgroundJobs: e.NO_BACKGROUND_JOBS,
      mode: (e.APP_MODE || "local") as "local" | "cloud", // checked above (APP_MODE: Vite and others already use MODE)
      auth: {
        // local mode never signs anyone in, so it needs no secret of its own
        secret: e.BETTER_AUTH_SECRET || "local-mode-has-no-sign-in-so-this-secret-is-never-used",
        publicUrl: e.PUBLIC_URL || `http://localhost:${e.PORT || 4000}`,
        google: e.GOOGLE_CLIENT_ID ? { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET } : null,
      },
      mailDryRun: e.MAIL_DRY_RUN,
      // in the demo every secret is blanked, so nobody can spend someone else's credits or post as them
      deepseek: { apiKey: demo ? "" : e.DEEPSEEK_API_KEY, url: e.DEEPSEEK_URL || "https://api.deepseek.com/chat/completions", model: e.DEEPSEEK_MODEL || "deepseek-chat" },
      n8nWebhookUrl: demo ? "" : e.N8N_WEBHOOK_URL,
      googleBooksApiKey: demo ? "" : e.GOOGLE_BOOKS_API_KEY,
      bookSourcesUrl: e.BOOK_SOURCES_URL,
      gmail: { user: e.GMAIL_USER, appKey: demo ? "" : e.GMAIL_APP_KEY.replace(/\s+/g, "") },
      settingsFile: e.SETTINGS_FILE,
      backupDir: e.BACKUP_DIR,
      logLevel: (e.LOG_LEVEL || "info") as LogLevel, // checked above
      corsOrigins: e.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
      rateLimit: { perMinute: Number(e.RATE_LIMIT_PER_MINUTE || 600), aiPerMinute: Number(e.AI_RATE_LIMIT_PER_MINUTE || 30) },
      fileStorage: {
        kind: (e.FILE_STORAGE || "database") as "database" | "disk" | "s3", // checked above
        dir: e.FILE_STORAGE_DIR,
        s3: { endpoint: e.S3_ENDPOINT, bucket: e.S3_BUCKET, accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY, region: e.S3_REGION || "auto" },
      },
    },
  };
}

/** The message shown when the app refuses to start. */
export const configErrorMessage = (problems: string[], where: string) =>
  [`Hyperfocus can't start: ${problems.length === 1 ? "a setting needs" : `${problems.length} settings need`} fixing in ${where}`, ...problems.map((p) => `  - ${p}`)].join("\n");
