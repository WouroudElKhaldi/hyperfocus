import { z } from "zod";
import { Id, IsoDateTime } from "./primitives.ts";

// Email (P2-16): drafts written in the rich editor, files, templates, and sending from her Gmail. The HTML is cleaned by
// the API (scripts and unknown tags removed) and a plain-text copy is kept next to it.

/** What the editor sends for a draft. Missing fields become empty (a PUT saves the whole draft). */
export const EmailFieldsInput = z.object({ toAddr: z.string(), ccAddr: z.string(), bccAddr: z.string(), subject: z.string(), html: z.string() }).partial();
export type EmailFieldsInput = z.input<typeof EmailFieldsInput>;

/** POST /api/emails/:id/attachments?name=…&inline=1 (the body is the file itself). */
export const UploadQuery = z.object({ name: z.string().optional(), inline: z.string().optional() });

/** POST /api/emails/:id/save-template. Without a name, the subject (or "Untitled template") is used. */
export const SaveTemplateInput = z.object({ name: z.string(), subject: z.string(), html: z.string() }).partial();

/** PATCH /api/email-templates/:id */
export const RenameTemplateInput = z.object({
  name: z.preprocess((v) => String(v || "").trim().slice(0, 100), z.string().min(1, "Give the template a name.")),
});

/** POST /api/ai/polish-email */
export const PolishEmailInput = z.object({ subject: z.string(), html: z.string() }).partial();

// ---------- what the API sends back (P3-03: documented, so the website's generated types are exact) ----------
/** A file of an email or template (never its bytes). inline = an image shown inside the body. */
export const Attachment = z.object({ id: Id, filename: z.string(), mime: z.string(), size: z.number().int(), inline: z.boolean() });
/** The job an email belongs to, in short. */
export const JobRef = z.object({ id: Id, company: z.string(), title: z.string() });

/** One email in the list: no body, a preview instead, and how many files (not counting images in the body). */
export const EmailListItem = z.object({
  id: Id, toAddr: z.string(), ccAddr: z.string(), subject: z.string(), status: z.string(), sentAt: IsoDateTime.nullable(),
  lastError: z.string(), createdAt: IsoDateTime, updatedAt: IsoDateTime, jobId: Id.nullable(), job: JobRef.nullable(),
  preview: z.string(), files: z.number().int(),
});
/** An email with its files. status: draft | sending | sent | failed. `job` is included when the email is opened. */
export const Email = z.object({
  id: Id, toAddr: z.string(), ccAddr: z.string(), bccAddr: z.string(), subject: z.string(), html: z.string(), body: z.string(),
  status: z.string(), sentAt: IsoDateTime.nullable(), fromAddr: z.string(), messageId: z.string(), lastError: z.string(),
  createdAt: IsoDateTime, updatedAt: IsoDateTime, jobId: Id.nullable(), job: JobRef.nullable().optional(), attachments: z.array(Attachment),
});
export const EmailSent = z.object({ ok: z.literal(true), email: Email.omit({ attachments: true, job: true }) });
export const EmailTemplate = z.object({ id: Id, name: z.string(), subject: z.string(), createdAt: IsoDateTime, updatedAt: IsoDateTime, preview: z.string(), files: z.number().int() });
export const TemplateRef = z.object({ id: Id, name: z.string() });
export const MailStatus = z.object({ ready: z.boolean(), user: z.string(), hasKey: z.boolean(), hasUser: z.boolean() });
export const PolishedEmail = z.object({ subject: z.string(), html: z.string(), changes: z.array(z.string()) });
