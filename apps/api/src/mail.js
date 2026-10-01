import express from "express";
import nodemailer from "nodemailer";
import sanitizeHtml from "sanitize-html";
import { chat } from "./ai.js";
import { jobSent } from "./jobs.js";

// Email: write (rich text), keep drafts and templates, send from her own Gmail, and remember what was sent.
// Gmail needs the address (GMAIL_USER) and an App Password (GMAIL_APP_KEY), see https://myaccount.google.com/apppasswords

const MAX_FILE = 20 * 1024 * 1024;
const MAX_TOTAL = 24 * 1024 * 1024; // Gmail refuses messages over 25 MB
const ADDR = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const ATT_URL = /\/api\/emails\/attachments\/(\d+)/;

const err = (status, message) => Object.assign(new Error(message), { status });
const cfg = () => ({ user: (process.env.GMAIL_USER || "").trim(), pass: (process.env.GMAIL_APP_KEY || "").replace(/\s+/g, "") });

// Everything the editor produces is run through this, so a pasted page can never smuggle in scripts.
export const cleanHtml = (html) =>
  sanitizeHtml(String(html || ""), {
    allowedTags: ["p", "br", "div", "span", "b", "strong", "i", "em", "u", "s", "strike", "h1", "h2", "h3", "blockquote", "pre", "code", "ul", "ol", "li", "a", "img", "hr", "font", "table", "thead", "tbody", "tr", "td", "th"],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height", "style"],
      "*": ["style", "align"],
      font: ["color", "face"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "cid"] },
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i, /^[a-z]+$/i],
        "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i, /^[a-z]+$/i],
        "text-align": [/^(left|right|center|justify)$/],
        "font-size": [/^[\d.]+(px|pt|em|rem|%)$/],
        "font-family": [/^[\w\s,'"-]+$/],
        "font-weight": [/^(normal|bold|\d{3})$/],
        "font-style": [/^(normal|italic)$/],
        "text-decoration": [/^[a-z\s-]+$/],
        "text-decoration-line": [/^[a-z\s-]+$/],
        width: [/^[\d.]+(px|%)$/],
        height: [/^[\d.]+(px|%)$/],
        "max-width": [/^[\d.]+(px|%)$/],
      },
    },
    transformTags: { a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }, true) },
    // relative image urls are only allowed for our own attachment route
    exclusiveFilter: (f) => f.tag === "img" && !!f.attribs.src && !/^(https?:|cid:|\/api\/emails\/attachments\/)/i.test(f.attribs.src),
  });

export const textOf = (html) =>
  sanitizeHtml(String(html || "").replace(/<\/(p|div|h[1-3]|li|tr|blockquote)>|<br\s*\/?>/gi, "\n"), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const addrList = (s) => String(s || "").split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
const checkAddrs = (label, list) => {
  const bad = list.find((a) => !ADDR.test(a));
  if (bad) throw err(400, `"${bad}" is not a valid email address (${label}).`);
};

// ---- the AI "fix my English" pass. It may only change words inside the text, never the layout. ----
const tagsOf = (html) => (String(html).match(/<[^>]+>/g) || []).join("");
export async function polishEmail({ subject, html }) {
  const out = await chat(
    [
      {
        role: "system",
        content: `You are a careful proofreader for an email written by a non-native English speaker. Make the SMALLEST edits that make it correct, natural English.
You MUST fix EVERY one of these, none may be left: spelling, typos, wrong words, grammar, punctuation, and capitalization (the first letter of every sentence, the greeting, names, the word "I", the first letter of the subject line). Also fix repeated words. Also smooth clearly awkward or unnatural phrasing with the fewest words changed, the way a native speaker would say it.
Keep EXACTLY: the meaning, the order of sentences, the tone, the greeting and sign-off wording, names, email addresses, links, numbers, dates, and the language she wrote in. Do not add or remove sentences, do not add pleasantries, do not make it more formal or more casual, do not "improve" her style.
The body is HTML. Return the SAME HTML: every tag and attribute must stay exactly where it is. Change only the words inside the tags. Never touch <img> tags.
If something is already fine, leave it unchanged. If the whole email is clean, return it exactly as it was.
Reply ONLY with JSON: {"subject": string, "html": string, "changes": string[]} where "changes" lists each edit briefly, like "recieve -> receive" (empty array if none).`,
      },
      { role: "user", content: `Subject: ${subject || ""}\n\nBody HTML:\n${html}` },
    ],
    { json: true, temperature: 0.1 },
  );
  const newHtml = String(out.html ?? "");
  const newSubject = String(out.subject ?? subject ?? "");
  const drift = Math.abs(textOf(newHtml).length - textOf(html).length) / Math.max(textOf(html).length, 1);
  if (!newHtml.trim() || tagsOf(newHtml) !== tagsOf(html) || drift > 0.25) {
    throw err(502, "The AI changed too much (or the formatting), so I kept your email as it is. Try again.");
  }
  return { subject: subject ? newSubject : "", html: cleanHtml(newHtml), changes: Array.isArray(out.changes) ? out.changes.map(String) : [] };
}

export function registerMail(app, prisma, wrap, { demo = false } = {}) {
  const id = (req) => Number(req.params.id);
  const slim = { select: { id: true, filename: true, mime: true, size: true, inline: true } };
  const full = (e) => ({ ...e, attachments: e.attachments || [] });
  const total = async (where) => (await prisma.emailAttachment.aggregate({ where, _sum: { size: true } }))._sum.size || 0;

  // `to` may be empty while it is still a draft; everything is checked when she sends.
  const fields = (b) => {
    const html = cleanHtml(b.html);
    return { toAddr: String(b.toAddr ?? "").trim(), ccAddr: String(b.ccAddr ?? "").trim(), bccAddr: String(b.bccAddr ?? "").trim(), subject: String(b.subject ?? "").slice(0, 300), html, body: textOf(html) };
  };

  app.get("/api/emails/status", (_, res) => {
    const { user, pass } = cfg();
    res.json({ ready: !!(user && pass && !demo), user, hasKey: !!pass, hasUser: !!user });
  });

  // ----- emails -----
  app.get("/api/emails", wrap(async (_, res) => {
    const rows = await prisma.email.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, toAddr: true, ccAddr: true, subject: true, body: true, status: true, sentAt: true, lastError: true, createdAt: true, updatedAt: true, jobId: true, job: { select: { id: true, company: true, title: true } }, _count: { select: { attachments: { where: { inline: false } } } } } });
    res.json(rows.map(({ _count, body, ...e }) => ({ ...e, preview: body.slice(0, 160), files: _count.attachments })));
  }));
  app.post("/api/emails", wrap(async (req, res) => {
    const email = await prisma.email.create({ data: req.body && Object.keys(req.body).length ? fields(req.body) : {} });
    res.json(full(email));
  }));
  app.get("/api/emails/:id", wrap(async (req, res) => {
    const e = await prisma.email.findUnique({ where: { id: id(req) }, include: { attachments: { ...slim, orderBy: { id: "asc" } }, job: { select: { id: true, company: true, title: true } } } });
    if (!e) return res.status(404).json({ error: "Email not found." });
    res.json(full(e));
  }));
  app.put("/api/emails/:id", wrap(async (req, res) => {
    const cur = await prisma.email.findUnique({ where: { id: id(req) } });
    if (!cur) return res.status(404).json({ error: "Email not found." });
    if (cur.status === "sent" || cur.status === "sending") return res.status(409).json({ error: "This email was already sent, so it can't be edited. Duplicate it to write a new one." });
    const e = await prisma.email.update({ where: { id: cur.id }, data: fields(req.body), include: { attachments: slim } });
    res.json(full(e));
  }));
  app.delete("/api/emails/:id", wrap(async (req, res) => {
    const r = await prisma.email.deleteMany({ where: { id: id(req), status: { not: "sending" } } });
    res.json({ ok: r.count > 0 });
  }));
  // a copy of any email (also a sent one) as a fresh draft, with its files
  app.post("/api/emails/:id/duplicate", wrap(async (req, res) => {
    const src = await prisma.email.findUnique({ where: { id: id(req) }, include: { attachments: true } });
    if (!src) return res.status(404).json({ error: "Email not found." });
    res.json(full(await cloneInto(prisma, { toAddr: src.toAddr, ccAddr: src.ccAddr, bccAddr: src.bccAddr, subject: src.subject, html: src.html, body: src.body }, src.attachments, "email")));
  }));

  // ----- files: raw upload (the browser sends the file itself, the name goes in ?name=) -----
  const upload = express.raw({ type: () => true, limit: MAX_FILE });
  const addFile = (owner) => wrap(async (req, res) => {
    const where = owner === "email" ? { emailId: id(req) } : { templateId: id(req) };
    const parent = await (owner === "email" ? prisma.email : prisma.emailTemplate).findUnique({ where: { id: id(req) } });
    if (!parent) return res.status(404).json({ error: "Not found." });
    if (owner === "email" && parent.status === "sent") return res.status(409).json({ error: "This email was already sent." });
    const data = req.body;
    if (!Buffer.isBuffer(data) || !data.length) return res.status(400).json({ error: "That file is empty." });
    if ((await total(where)) + data.length > MAX_TOTAL) return res.status(413).json({ error: "Gmail allows about 25 MB per email in total. Remove a file first." });
    const filename = String(req.query.name || "file").replace(/[\\/:*?"<>|\r\n]+/g, "_").slice(0, 150) || "file";
    const inline = req.query.inline === "1";
    const mime = String(req.headers["x-file-type"] || "application/octet-stream").slice(0, 100);
    if (inline && !/^image\/(png|jpe?g|gif|webp)$/i.test(mime)) return res.status(400).json({ error: "Only PNG, JPG, GIF or WebP images can go inside the email." });
    const a = await prisma.emailAttachment.create({ data: { ...where, filename, mime, inline, size: data.length, data }, ...slim });
    res.json(a);
  });
  app.post("/api/emails/:id/attachments", upload, addFile("email"));
  app.post("/api/email-templates/:id/attachments", upload, addFile("template"));
  app.get("/api/emails/attachments/:id", wrap(async (req, res) => {
    const a = await prisma.emailAttachment.findUnique({ where: { id: id(req) } });
    if (!a) return res.status(404).end();
    const safeImage = /^image\/(png|jpe?g|gif|webp)$/i.test(a.mime);
    res.setHeader("Content-Type", safeImage ? a.mime : "application/octet-stream"); // never let the browser run an uploaded file
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `${a.inline && safeImage ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.filename)}`);
    res.send(Buffer.from(a.data));
  }));
  app.delete("/api/emails/attachments/:id", wrap(async (req, res) => {
    const a = await prisma.emailAttachment.findUnique({ where: { id: id(req) }, include: { email: true } });
    if (a?.email?.status === "sent") return res.status(409).json({ error: "This email was already sent." });
    await prisma.emailAttachment.deleteMany({ where: { id: id(req) } });
    res.json({ ok: true });
  }));

  // ----- send -----
  app.post("/api/emails/:id/send", wrap(async (req, res) => {
    if (demo) throw err(403, "Sending is switched off in the demo.");
    const { user, pass } = cfg();
    if (!user || !pass) throw err(400, "Gmail is not set up. Add GMAIL_USER (your address) and GMAIL_APP_KEY (your app password) to apps/api/.env and restart.");
    // save what is on screen first, so what is sent is exactly what she sees
    if (req.body && req.body.html !== undefined) {
      const cur = await prisma.email.findUnique({ where: { id: id(req) } });
      if (cur && (cur.status === "draft" || cur.status === "failed")) await prisma.email.update({ where: { id: cur.id }, data: fields(req.body) });
    }
    // only one send can win, which makes a double click harmless
    const claimed = await prisma.email.updateMany({ where: { id: id(req), status: { in: ["draft", "failed"] } }, data: { status: "sending", lastError: "" } });
    if (!claimed.count) throw err(409, "This email is already sent or being sent.");
    const e = await prisma.email.findUnique({ where: { id: id(req) }, include: { attachments: true } });
    const back = async (message) => { await prisma.email.update({ where: { id: e.id }, data: { status: "failed", lastError: message } }); };
    try {
      const to = addrList(e.toAddr), cc = addrList(e.ccAddr), bcc = addrList(e.bccAddr);
      if (!to.length) throw err(400, "Add at least one recipient in “To”.");
      checkAddrs("To", to); checkAddrs("Cc", cc); checkAddrs("Bcc", bcc);
      if (!e.subject.trim() && !e.body.trim()) throw err(400, "The email is empty.");
      // images placed in the body travel inside the message (cid), the rest are normal attachments
      const byId = new Map(e.attachments.map((a) => [a.id, a]));
      const used = new Set();
      const html = e.html.replace(/(<img\b[^>]*?\bsrc=")([^"]*)(")/gi, (m, a, src, c) => {
        const hit = ATT_URL.exec(src);
        const att = hit && byId.get(Number(hit[1]));
        if (!att) return m;
        used.add(att.id);
        return `${a}cid:img${att.id}@mail${c}`;
      });
      const attachments = e.attachments
        .filter((a) => !a.inline || used.has(a.id))
        .map((a) => ({ filename: a.filename, content: Buffer.from(a.data), contentType: a.mime, ...(used.has(a.id) ? { cid: `img${a.id}@mail`, contentDisposition: "inline" } : {}) }));
      const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
      const info = await transport.sendMail({
        from: user, to, cc: cc.length ? cc : undefined, bcc: bcc.length ? bcc : undefined,
        subject: e.subject || "(no subject)",
        text: e.body,
        html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5">${html}</div>`,
        attachments,
      });
      const done = await prisma.email.update({ where: { id: e.id }, data: { status: "sent", sentAt: new Date(), fromAddr: user, messageId: String(info.messageId || ""), lastError: "" } });
      await jobSent(prisma, done).catch(() => {}); // the email is already sent, a job-update hiccup must not look like a failed send
      res.json({ ok: true, email: done });
    } catch (x) {
      const bad = x.code === "EAUTH" ? "Gmail refused the login. Check GMAIL_USER and that GMAIL_APP_KEY is an App Password (needs 2-Step Verification)." : x.status ? x.message : `Could not send: ${x.message}`;
      await back(bad);
      throw err(x.status || 502, bad);
    }
  }));

  // ----- templates -----
  app.get("/api/email-templates", wrap(async (_, res) => {
    const rows = await prisma.emailTemplate.findMany({ orderBy: { updatedAt: "desc" }, include: { _count: { select: { attachments: { where: { inline: false } } } } } });
    res.json(rows.map(({ _count, html, ...t }) => ({ ...t, preview: textOf(html).slice(0, 160), files: _count.attachments })));
  }));
  // save an email as a template (with its files)
  app.post("/api/emails/:id/save-template", wrap(async (req, res) => {
    const src = await prisma.email.findUnique({ where: { id: id(req) }, include: { attachments: true } });
    if (!src) return res.status(404).json({ error: "Email not found." });
    const name = String(req.body.name || src.subject || "Untitled template").trim().slice(0, 100);
    const html = cleanHtml(req.body.html ?? src.html);
    const t = await cloneInto(prisma, { name, subject: String(req.body.subject ?? src.subject), html }, src.attachments, "template", html);
    res.json({ id: t.id, name: t.name });
  }));
  app.patch("/api/email-templates/:id", wrap(async (req, res) => {
    const name = String(req.body.name || "").trim().slice(0, 100);
    if (!name) return res.status(400).json({ error: "Give the template a name." });
    res.json(await prisma.emailTemplate.update({ where: { id: id(req) }, data: { name }, select: { id: true, name: true } }));
  }));
  app.delete("/api/email-templates/:id", wrap(async (req, res) => { await prisma.emailTemplate.deleteMany({ where: { id: id(req) } }); res.json({ ok: true }); }));
  // a new draft from a template
  app.post("/api/email-templates/:id/use", wrap(async (req, res) => {
    const t = await prisma.emailTemplate.findUnique({ where: { id: id(req) }, include: { attachments: true } });
    if (!t) return res.status(404).json({ error: "Template not found." });
    res.json(full(await cloneInto(prisma, { subject: t.subject, html: t.html, body: textOf(t.html) }, t.attachments, "email")));
  }));

  app.post("/api/ai/polish-email", wrap(async (req, res) => {
    const html = cleanHtml(req.body.html);
    if (!textOf(html)) return res.status(400).json({ error: "There is nothing to polish." });
    res.json(await polishEmail({ subject: String(req.body.subject || ""), html }));
  }));
}

// Copies an email/template and its files into a new email/template. Images inside the body are re-pointed to the copies.
async function cloneInto(prisma, data, files, kind, htmlOverride) {
  const model = kind === "email" ? prisma.email : prisma.emailTemplate;
  const fk = kind === "email" ? "emailId" : "templateId";
  const created = await model.create({ data });
  const ids = new Map(); // old attachment id -> id of its copy
  for (const f of files) {
    const copy = await prisma.emailAttachment.create({ data: { filename: f.filename, mime: f.mime, size: f.size, inline: f.inline, data: f.data, [fk]: created.id }, select: { id: true } });
    ids.set(f.id, copy.id);
  }
  const html = (htmlOverride ?? data.html ?? "").replace(/\/api\/emails\/attachments\/(\d+)/g, (m, n) => (ids.has(Number(n)) ? `/api/emails/attachments/${ids.get(Number(n))}` : m));
  if (html !== (data.html ?? "")) return model.update({ where: { id: created.id }, data: { html, ...(kind === "email" ? { body: textOf(html) } : {}) }, include: { attachments: { select: { id: true, filename: true, mime: true, size: true, inline: true } } } });
  return model.findUnique({ where: { id: created.id }, include: { attachments: { select: { id: true, filename: true, mime: true, size: true, inline: true } } } });
}
