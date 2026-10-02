import nodemailer from "nodemailer";
import { errorInfo, httpError } from "../../types.ts";

// Sending email (P2-16) behind a port: her Gmail with an App Password today (local mode), Gmail OAuth per user later
// (P5-08), or a dry-run provider. The email module only talks to this interface.

export type OutgoingFile = { filename: string; content: Buffer; contentType: string; cid?: string; contentDisposition?: "inline" };
export type OutgoingMail = { to: string[]; cc: string[]; bcc: string[]; subject: string; text: string; html: string; attachments: OutgoingFile[] };

export type MailStatus = { ready: boolean; user: string; hasKey: boolean; hasUser: boolean };

export type MailProvider = {
  /** What the Email page shows: is sending set up, and from which address. */
  status(): MailStatus;
  /** Why it can't send right now (HTTP status and message), or null. */
  unavailable(): { status: number; message: string } | null;
  /** Sends; the address it was sent from and the message id come back. Failures throw with a message for her. */
  send(mail: OutgoingMail): Promise<{ from: string; messageId: string }>;
};

/** Gmail through SMTP with an App Password (GMAIL_USER + GMAIL_APP_KEY, see https://myaccount.google.com/apppasswords). */
export function gmailAppPassword({ user, appKey }: { user: string; appKey: string }, { demo = false } = {}): MailProvider {
  return {
    status: () => ({ ready: !!(user && appKey && !demo), user, hasKey: !!appKey, hasUser: !!user }),
    unavailable: () =>
      demo ? { status: 403, message: "Sending is switched off in the demo." }
      : !user || !appKey ? { status: 400, message: "Gmail is not set up. Add GMAIL_USER (your address) and GMAIL_APP_KEY (your app password) to the .env file at the project root and restart." }
      : null,
    async send(mail) {
      const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass: appKey } });
      try {
        const info = await transport.sendMail({
          from: user, to: mail.to, cc: mail.cc.length ? mail.cc : undefined, bcc: mail.bcc.length ? mail.bcc : undefined,
          subject: mail.subject, text: mail.text, html: mail.html, attachments: mail.attachments,
        });
        return { from: user, messageId: String(info.messageId || "") };
      } catch (e) {
        if (errorInfo(e).code === "EAUTH") throw httpError(502, "Gmail refused the login. Check GMAIL_USER and that GMAIL_APP_KEY is an App Password (needs 2-Step Verification).");
        throw e;
      }
    },
  };
}
