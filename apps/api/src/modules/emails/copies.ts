import type { EmailAttachment, Prisma } from "@hyperfocus/db";
import type { Db } from "../../types.ts";
import { repoint, textOf } from "./html.ts";

// Copies an email or template with its files into a new email or template (duplicate, save as template, use a template).
// Images inside the body are re-pointed to the copies of their files.

/** The fields of a file that the API sends back (never its bytes). */
export const SLIM = { id: true, filename: true, mime: true, size: true, inline: true } as const;
type FileCopy = Pick<EmailAttachment, "id" | "filename" | "mime" | "size" | "inline" | "data">;

/** Copies the files to their new owner; returns old attachment id -> id of its copy. */
async function copyFiles(prisma: Db, files: FileCopy[], owner: { emailId: number } | { templateId: number }) {
  const ids = new Map<number, number>();
  for (const f of files) {
    const copy = await prisma.emailAttachment.create({ data: { filename: f.filename, mime: f.mime, size: f.size, inline: f.inline, data: f.data, ...owner }, select: { id: true } });
    ids.set(f.id, copy.id);
  }
  return ids;
}

export async function cloneEmail(prisma: Db, data: Prisma.EmailUncheckedCreateInput, files: FileCopy[]) {
  const created = await prisma.email.create({ data });
  const html = repoint(data.html ?? "", await copyFiles(prisma, files, { emailId: created.id }));
  if (html !== (data.html ?? "")) return prisma.email.update({ where: { id: created.id }, data: { html, body: textOf(html) }, include: { attachments: { select: SLIM } } });
  return prisma.email.findUniqueOrThrow({ where: { id: created.id }, include: { attachments: { select: SLIM } } });
}

export async function cloneTemplate(prisma: Db, data: Prisma.EmailTemplateUncheckedCreateInput, files: FileCopy[]) {
  const created = await prisma.emailTemplate.create({ data });
  const html = repoint(data.html ?? "", await copyFiles(prisma, files, { templateId: created.id }));
  if (html !== (data.html ?? "")) return prisma.emailTemplate.update({ where: { id: created.id }, data: { html }, include: { attachments: { select: SLIM } } });
  return prisma.emailTemplate.findUniqueOrThrow({ where: { id: created.id }, include: { attachments: { select: SLIM } } });
}
