import { z } from "zod";

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
