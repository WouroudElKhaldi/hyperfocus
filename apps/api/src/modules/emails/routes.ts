import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { prompts } from "@hyperfocus/ai";
import type { Prisma } from "@hyperfocus/db";
import { Attachment, Email, EmailFieldsInput, EmailListItem, EmailSent, EmailTemplate, MailStatus, PolishEmailInput, PolishedEmail, RenameTemplateInput, SaveTemplateInput, TemplateRef, UploadQuery } from "@hyperfocus/shared";
import type { AppDeps, AppEnv } from "../../app.ts";
import { IdParam, json, pathId, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { jobSent } from "../jobs/rules.ts";
import { errorInfo, httpError } from "../../types.ts";
import { attachmentFiles } from "../../storage/attachments.ts";
import { SLIM, cloneEmail, cloneTemplate } from "./copies.ts";
import { MAX_FILE, MAX_TOTAL, SAFE_IMAGE, addrList, checkAddrs, cleanHtml, emailFields, inlineImages, safeFilename, tagsOf, textOf } from "./html.ts";

// Email (P2-16): drafts, files (attachments and images in the body), sending through the MailProvider port (her Gmail
// today), templates, and the AI proofreader. Same answers as the Express routes had; changes:
// - an upload over 20 MB is a 413 problem with a message (Express answered with an HTML error page);
// - uploading to a missing email or template says which one ("Email not found." / "Template not found.").

const EMAIL_404 = "Email not found.";
const TEMPLATE_404 = "Template not found.";
const jobPick = { select: { id: true, company: true, title: true } } as const;
/** A JSON body that may be left out (the website sends some of these requests without one). */
const optionalBody = <S extends z.ZodType>(schema: S) => ({ content: { "application/json": { schema } }, required: false as const });

export function emailsRouter({ prisma, ai, mail, files }: AppDeps) {
  const store = attachmentFiles(files ?? null); // where the files' bytes are (P4-07)
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  const tags = ["Email"];
  const emailId = (raw: string | undefined) => pathId(raw, EMAIL_404);
  const full = <T extends object>(e: T & { attachments?: unknown[] }) => ({ ...e, attachments: e.attachments || [] });
  const total = async (where: Prisma.EmailAttachmentWhereInput) => (await prisma.emailAttachment.aggregate({ where, _sum: { size: true } }))._sum.size || 0;

  app.openapi(
    createRoute({ method: "get", path: "/api/emails/status", tags, summary: "Is sending set up (Gmail address and App Password)", responses: { 200: json(MailStatus, "Whether sending is set up") } }),
    (c) => c.json(mail.status(), 200),
  );

  // ---------- emails ----------
  app.openapi(
    createRoute({ method: "get", path: "/api/emails", tags, summary: "Every email, most recently changed first, with a preview", responses: { 200: json(z.array(EmailListItem), "The emails") } }),
    async (c) => {
      const rows = await prisma.email.findMany({
        orderBy: { updatedAt: "desc" },
        select: { id: true, toAddr: true, ccAddr: true, subject: true, body: true, status: true, sentAt: true, lastError: true, createdAt: true, updatedAt: true, jobId: true, job: jobPick, _count: { select: { attachments: { where: { inline: false } } } } },
      });
      return c.json(rows.map(({ _count, body, ...e }) => ({ ...e, preview: body.slice(0, 160), files: _count.attachments })), 200);
    },
  );
  app.openapi(
    createRoute({ method: "post", path: "/api/emails", tags, summary: "Start a draft (empty, or with what is sent)", request: { body: optionalBody(EmailFieldsInput) }, responses: { 200: json(Email, "The draft") } }),
    async (c) => {
      const b = c.req.valid("json") ?? {};
      return c.json(full(await prisma.email.create({ data: Object.keys(b).length ? emailFields(b) : {} })), 200);
    },
  );
  app.openapi(
    createRoute({ method: "get", path: "/api/emails/{id}", tags, summary: "One email with its files and job", request: { params: IdParam }, responses: { 200: json(Email, "The email"), 404: problem("No such email") } }),
    async (c) => {
      const e = await prisma.email.findUnique({ where: { id: emailId(c.req.param("id")) }, include: { attachments: { select: SLIM, orderBy: { id: "asc" } }, job: jobPick } });
      if (!e) throw httpError(404, EMAIL_404);
      return c.json(full(e), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "put", path: "/api/emails/{id}", tags, summary: "Save the draft (the whole draft is replaced)", request: { params: IdParam, body: optionalBody(EmailFieldsInput) },
      responses: { 200: json(Email, "The draft"), 404: problem("No such email"), 409: problem("Already sent") },
    }),
    async (c) => {
      const cur = await prisma.email.findUnique({ where: { id: emailId(c.req.param("id")) } });
      if (!cur) throw httpError(404, EMAIL_404);
      if (cur.status === "sent" || cur.status === "sending") throw httpError(409, "This email was already sent, so it can't be edited. Duplicate it to write a new one.");
      return c.json(full(await prisma.email.update({ where: { id: cur.id }, data: emailFields(c.req.valid("json") ?? {}), include: { attachments: { select: SLIM } } })), 200);
    },
  );
  app.openapi(
    createRoute({ method: "delete", path: "/api/emails/{id}", tags, summary: "Delete an email (not while it is being sent); ok is false when nothing was deleted", request: { params: IdParam }, responses: { 200: json(z.object({ ok: z.boolean() }), "Whether it was deleted") } }),
    async (c) => {
      const id = emailId(c.req.param("id"));
      const stored = await prisma.emailAttachment.findMany({ where: { emailId: id }, select: { storageKey: true } });
      const r = await prisma.email.deleteMany({ where: { id, status: { not: "sending" } } });
      if (r.count) await store.remove(stored); // its files' bytes go with it
      return c.json({ ok: r.count > 0 }, 200);
    },
  );
  app.openapi(
    createRoute({ method: "post", path: "/api/emails/{id}/duplicate", tags, summary: "A copy of any email (a sent one too) as a new draft, with its files", request: { params: IdParam }, responses: { 200: json(Email, "The new draft"), 404: problem("No such email") } }),
    async (c) => {
      const src = await prisma.email.findUnique({ where: { id: emailId(c.req.param("id")) }, include: { attachments: true } });
      if (!src) throw httpError(404, EMAIL_404);
      return c.json(full(await cloneEmail(prisma, store, { toAddr: src.toAddr, ccAddr: src.ccAddr, bccAddr: src.bccAddr, subject: src.subject, html: src.html, body: src.body }, src.attachments)), 200);
    },
  );

  // ---------- files: the browser sends the file itself, the name goes in ?name= ----------
  const uploadRoute = (owner: "email" | "template") =>
    createRoute({
      method: "post", path: owner === "email" ? "/api/emails/{id}/attachments" : "/api/email-templates/{id}/attachments", tags,
      summary: `Add a file to ${owner === "email" ? "an email" : "a template"} (inline=1: an image inside the body)`,
      request: { params: IdParam, query: UploadQuery, body: { content: { "application/octet-stream": { schema: z.string().openapi({ format: "binary" }) } }, required: true } },
      responses: { 200: json(Attachment, "The file (without its bytes)"), 400: problem("Empty, or not an image for the body"), 404: problem("Not found"), 409: problem("Already sent"), 413: problem("Too big") },
    });
  for (const owner of ["email", "template"] as const) {
    const notFound = owner === "email" ? EMAIL_404 : TEMPLATE_404;
    app.openapi(uploadRoute(owner), async (c) => {
      const id = pathId(c.req.param("id"), notFound);
      const where = owner === "email" ? { emailId: id } : { templateId: id };
      const parent = owner === "email" ? await prisma.email.findUnique({ where: { id } }) : await prisma.emailTemplate.findUnique({ where: { id } });
      if (!parent) throw httpError(404, notFound);
      if ("status" in parent && parent.status === "sent") throw httpError(409, "This email was already sent.");
      if (Number(c.req.header("content-length") || 0) > MAX_FILE) throw httpError(413, "That file is over 20 MB.");
      const data = new Uint8Array(await c.req.arrayBuffer());
      if (!data.length) throw httpError(400, "That file is empty.");
      if (data.length > MAX_FILE) throw httpError(413, "That file is over 20 MB.");
      if ((await total(where)) + data.length > MAX_TOTAL) throw httpError(413, "Gmail allows about 25 MB per email in total. Remove a file first.");
      const q = c.req.valid("query");
      const inline = q.inline === "1";
      const mime = String(c.req.header("x-file-type") || "application/octet-stream").slice(0, 100);
      if (inline && !SAFE_IMAGE.test(mime)) throw httpError(400, "Only PNG, JPG, GIF or WebP images can go inside the email.");
      const saved = await store.save(data, mime);
      return c.json(await prisma.emailAttachment.create({ data: { ...where, filename: safeFilename(q.name), mime, inline, size: data.length, ...saved }, select: SLIM }), 200);
    });
  }
  app.openapi(
    createRoute({
      method: "get", path: "/api/emails/attachments/{id}", tags, summary: "Download a file (only safe images are shown in the page; everything else downloads)", request: { params: IdParam },
      responses: { 200: { description: "The file", content: { "application/octet-stream": { schema: z.string().openapi({ format: "binary" }) } } }, 404: { description: "No such file" } },
    }),
    async (c) => {
      const raw = c.req.param("id");
      const a = /^\d+$/.test(raw) ? await prisma.emailAttachment.findUnique({ where: { id: Number(raw) } }) : null;
      const bytes = a ? await store.read(a) : null;
      if (!a || !bytes) return c.body(null, 404);
      const safeImage = SAFE_IMAGE.test(a.mime);
      return c.body(Buffer.from(bytes), 200, {
        "Content-Type": safeImage ? a.mime : "application/octet-stream", // never let the browser run an uploaded file
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `${a.inline && safeImage ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.filename)}`,
      });
    },
  );
  app.openapi(
    createRoute({ method: "delete", path: "/api/emails/attachments/{id}", tags, summary: "Remove a file (already gone is fine)", request: { params: IdParam }, responses: { 200: json(z.object({ ok: z.literal(true) }), "Removed"), 409: problem("Its email was already sent") } }),
    async (c) => {
      const id = pathId(c.req.param("id"), "File not found.");
      const a = await prisma.emailAttachment.findUnique({ where: { id }, include: { email: true } });
      if (a?.email?.status === "sent") throw httpError(409, "This email was already sent.");
      const r = await prisma.emailAttachment.deleteMany({ where: { id } });
      if (r.count && a) await store.remove([a]);
      return c.json({ ok: true as const }, 200);
    },
  );

  // ---------- send ----------
  app.openapi(
    createRoute({
      method: "post", path: "/api/emails/{id}/send", tags, summary: "Send it (what is on screen is saved first). A double click is harmless.",
      request: { params: IdParam, body: optionalBody(EmailFieldsInput) },
      responses: { 200: json(EmailSent, "Sent"), 400: problem("Not set up, or something to fix"), 409: problem("Already sent or being sent"), 502: problem("Gmail failed") },
    }),
    async (c) => {
      const why = mail.unavailable();
      if (why) throw httpError(why.status, why.message);
      const id = emailId(c.req.param("id"));
      const b = c.req.valid("json") ?? {};
      // save what is on screen first, so what is sent is exactly what she sees
      if (b.html !== undefined) {
        const cur = await prisma.email.findUnique({ where: { id } });
        if (cur && (cur.status === "draft" || cur.status === "failed")) await prisma.email.update({ where: { id: cur.id }, data: emailFields(b) });
      }
      // only one send can win, which makes a double click harmless
      const claimed = await prisma.email.updateMany({ where: { id, status: { in: ["draft", "failed"] } }, data: { status: "sending", lastError: "" } });
      if (!claimed.count) throw httpError(409, "This email is already sent or being sent.");
      const e = await prisma.email.findUnique({ where: { id }, include: { attachments: true } });
      if (!e) throw httpError(404, EMAIL_404); // only if it was deleted in the last millisecond
      try {
        const to = addrList(e.toAddr), cc = addrList(e.ccAddr), bcc = addrList(e.bccAddr);
        if (!to.length) throw httpError(400, "Add at least one recipient in “To”.");
        checkAddrs("To", to);
        checkAddrs("Cc", cc);
        checkAddrs("Bcc", bcc);
        if (!e.subject.trim() && !e.body.trim()) throw httpError(400, "The email is empty.");
        // images placed in the body travel inside the message (cid), the rest are normal attachments
        const { html, used } = inlineImages(e.html, new Set(e.attachments.map((a) => a.id)));
        const contents = await Promise.all(e.attachments.map((a) => store.read(a)));
        if (contents.some((b) => !b)) throw httpError(500, "A file of this email is missing from the file storage. Remove it and attach it again.");
        const sent = await mail.send({
          to, cc, bcc,
          subject: e.subject || "(no subject)",
          text: e.body,
          html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5">${html}</div>`,
          attachments: e.attachments
            .map((a, i) => ({ a, bytes: contents[i] as Uint8Array }))
            .filter(({ a }) => !a.inline || used.has(a.id))
            .map(({ a, bytes }) => ({ filename: a.filename, content: Buffer.from(bytes), contentType: a.mime, ...(used.has(a.id) ? { cid: `img${a.id}@mail`, contentDisposition: "inline" as const } : {}) })),
        });
        const done = await prisma.email.update({ where: { id: e.id }, data: { status: "sent", sentAt: new Date(), fromAddr: sent.from, messageId: sent.messageId, lastError: "" } });
        await jobSent(prisma, done).catch(() => {}); // the email is already sent, a job-update hiccup must not look like a failed send
        return c.json({ ok: true, email: done }, 200);
      } catch (thrown) {
        const x = errorInfo(thrown);
        const message = x.status ? x.message : `Could not send: ${x.message}`;
        await prisma.email.update({ where: { id: e.id }, data: { status: "failed", lastError: message } });
        throw httpError(x.status || 502, message);
      }
    },
  );

  // ---------- templates ----------
  app.openapi(
    createRoute({ method: "get", path: "/api/email-templates", tags, summary: "The templates, with a preview", responses: { 200: json(z.array(EmailTemplate), "The templates") } }),
    async (c) => {
      const rows = await prisma.emailTemplate.findMany({ orderBy: { updatedAt: "desc" }, include: { _count: { select: { attachments: { where: { inline: false } } } } } });
      return c.json(rows.map(({ _count, html, ...t }) => ({ ...t, preview: textOf(html).slice(0, 160), files: _count.attachments })), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "post", path: "/api/emails/{id}/save-template", tags, summary: "Save an email as a template (with its files)", request: { params: IdParam, body: optionalBody(SaveTemplateInput) },
      responses: { 200: json(TemplateRef, "The template"), 404: problem("No such email") },
    }),
    async (c) => {
      const src = await prisma.email.findUnique({ where: { id: emailId(c.req.param("id")) }, include: { attachments: true } });
      if (!src) throw httpError(404, EMAIL_404);
      const b = c.req.valid("json") ?? {};
      const name = String(b.name || src.subject || "Untitled template").trim().slice(0, 100);
      const t = await cloneTemplate(prisma, store, { name, subject: b.subject ?? src.subject, html: cleanHtml(b.html ?? src.html) }, src.attachments);
      return c.json({ id: t.id, name: t.name }, 200);
    },
  );
  app.openapi(
    createRoute({
      method: "patch", path: "/api/email-templates/{id}", tags, summary: "Rename a template", request: { params: IdParam, body: { content: { "application/json": { schema: RenameTemplateInput } }, required: true } },
      responses: { 200: json(TemplateRef, "The template"), 400: problem("No name"), 404: problem("No such template") },
    }),
    async (c) => {
      const id = pathId(c.req.param("id"), TEMPLATE_404);
      const { count } = await prisma.emailTemplate.updateMany({ where: { id }, data: { name: c.req.valid("json").name } });
      if (!count) throw httpError(404, TEMPLATE_404);
      return c.json(await prisma.emailTemplate.findUniqueOrThrow({ where: { id }, select: { id: true, name: true } }), 200);
    },
  );
  app.openapi(
    createRoute({ method: "delete", path: "/api/email-templates/{id}", tags, summary: "Delete a template (already gone is fine)", request: { params: IdParam }, responses: { 200: json(z.object({ ok: z.literal(true) }), "Deleted") } }),
    async (c) => {
      const id = pathId(c.req.param("id"), TEMPLATE_404);
      const stored = await prisma.emailAttachment.findMany({ where: { templateId: id }, select: { storageKey: true } });
      const r = await prisma.emailTemplate.deleteMany({ where: { id } });
      if (r.count) await store.remove(stored);
      return c.json({ ok: true as const }, 200);
    },
  );
  app.openapi(
    createRoute({ method: "post", path: "/api/email-templates/{id}/use", tags, summary: "A new draft from a template (with its files)", request: { params: IdParam }, responses: { 200: json(Email, "The new draft"), 404: problem("No such template") } }),
    async (c) => {
      const t = await prisma.emailTemplate.findUnique({ where: { id: pathId(c.req.param("id"), TEMPLATE_404) }, include: { attachments: true } });
      if (!t) throw httpError(404, TEMPLATE_404);
      return c.json(full(await cloneEmail(prisma, store, { subject: t.subject, html: t.html, body: textOf(t.html) }, t.attachments)), 200);
    },
  );

  // ---------- the AI proofreader: it may only change words inside the text, never the layout ----------
  app.openapi(
    createRoute({
      method: "post", path: "/api/ai/polish-email", tags: ["AI"], summary: "AI: fix the English of an email, keeping every tag", request: { body: { content: { "application/json": { schema: PolishEmailInput } }, required: true } },
      responses: { 200: json(PolishedEmail, "The fixed email"), 400: problem("Nothing to polish"), 502: problem("The AI changed too much") },
    }),
    async (c) => {
      const b = c.req.valid("json");
      const html = cleanHtml(b.html);
      if (!textOf(html)) throw httpError(400, "There is nothing to polish.");
      const subject = String(b.subject || "");
      const out = await ai.run(prompts.polishEmail, { subject, html });
      const drift = Math.abs(textOf(out.html).length - textOf(html).length) / Math.max(textOf(html).length, 1);
      if (!out.html.trim() || tagsOf(out.html) !== tagsOf(html) || drift > 0.25) throw httpError(502, "The AI changed too much (or the formatting), so I kept your email as it is. Try again.");
      return c.json({ subject: subject ? (out.subject ?? subject) : "", html: cleanHtml(out.html), changes: out.changes }, 200);
    },
  );

  return app;
}
