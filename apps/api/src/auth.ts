import type { ApiConfig } from "@hyperfocus/shared/config";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import type { Logger } from "pino";
import { type AccountEmail, accountEmailHtml, accountEmailText } from "./account-email.ts";
import type { MailProvider } from "./modules/emails/mail-provider.ts";
import type { Db } from "./types.ts";

// Accounts and sign-in (P5-01), with Better Auth (MIT): email + password, email verification, password reset, sessions in
// our own database, and "Sign in with Google" when its keys are set. Everything lives under /api/auth/*.
// Used in cloud mode only (APP_MODE=cloud); local mode has one owner account and nobody signs in.

/** The emails accounts need (verify, reset). Through the app's mail provider; written to the log in tests (MAIL_DRY_RUN). */
export function authMailer({ mail, log, dryRun }: { mail: MailProvider; log: Pick<Logger, "info" | "error">; dryRun: boolean }) {
  // a styled email with one button (accounts), or plain text (the background jobs' notes)
  return async (to: string, subject: string, email: AccountEmail | string) => {
    const text = typeof email === "string" ? email : accountEmailText(email);
    if (dryRun) {
      // one line the tests can read the link from
      console.log(`[auth mail] to=${to} subject=${JSON.stringify(subject)} text=${JSON.stringify(text)}`);
      return;
    }
    const why = mail.unavailable();
    if (why) {
      log.error({ to, subject }, `Can't send an account email: ${why.message}`);
      return;
    }
    await mail.send({ to: [to], cc: [], bcc: [], subject, text, html: typeof email === "string" ? `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>` : accountEmailHtml(email), attachments: [] });
  };
}

/** A phone number people can be reached on: digits, with + spaces dashes dots or brackets, 7 to 15 digits. */
export const PHONE = /^\+?[\d\s\-().]{7,25}$/;
const phoneDigits = (p: string) => p.replace(/\D/g, "").length;

export function createAuth({ prisma, config, send }: { prisma: Db; config: ApiConfig; send: ReturnType<typeof authMailer> }) {
  return betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    secret: config.auth.secret,
    baseURL: config.auth.publicUrl,
    basePath: "/api/auth",
    trustedOrigins: [config.auth.publicUrl, ...config.corsOrigins],
    // always check where a signed-in request comes from (cross-site request forgery). Better Auth turns this off by itself
    // when NODE_ENV is "test"; here it is on whatever the environment says (found by the P5-01 tests)
    advanced: { disableOriginCheck: false, disableCSRFCheck: false },
    // sign-up asks for the full name, the email and a phone number (P5-04, at your request)
    user: { additionalFields: { phone: { type: "string", required: false, defaultValue: "", input: true }, role: { type: "string", required: false, defaultValue: "user", input: false } } },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;
        const body = (ctx.body ?? {}) as { name?: unknown; phone?: unknown };
        const name = String(body.name ?? "").trim();
        const phone = String(body.phone ?? "").trim();
        if (name.length < 2) throw new APIError("BAD_REQUEST", { message: "Please write your full name." });
        if (!PHONE.test(phone) || phoneDigits(phone) < 7 || phoneDigits(phone) > 15) throw new APIError("BAD_REQUEST", { message: "Please add a phone number we can reach you on (like +961 70 123 456)." });
      }),
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      sendResetPassword: async ({ user, url }) => {
        await send(user.email, "Reset your Hyperfocus password", {
          title: "Choose a new password",
          intro: "Someone (hopefully you) asked to reset your Hyperfocus password. Press the button to pick a new one.",
          button: "Choose a new password", url,
          outro: "If it wasn't you, you can ignore this email: your password stays the same.",
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await send(user.email, "Confirm your email for Hyperfocus", {
          title: "Welcome to Hyperfocus 👋",
          intro: "One tap and you're in. Press the button to confirm your email; it signs you in and opens a short welcome.",
          button: "Confirm my email", url,
          outro: "Didn't make an account? You can ignore this email.",
        });
      },
    },
    ...(config.auth.google ? { socialProviders: { google: { clientId: config.auth.google.clientId, clientSecret: config.auth.google.clientSecret } } } : {}),
  });
}
export type Auth = ReturnType<typeof createAuth>;
