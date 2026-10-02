import sanitizeHtml from "sanitize-html";
import { httpError } from "../../types.ts";

// The pure rules of the email module (P2-16): cleaning what the editor sends, its plain-text version, addresses, and
// re-pointing images when an email or template is copied. No database, no network.

export const MAX_FILE = 20 * 1024 * 1024;
export const MAX_TOTAL = 24 * 1024 * 1024; // Gmail refuses messages over 25 MB
const ADDR = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
export const ATT_URL = /\/api\/emails\/attachments\/(\d+)/;
/** Images that may be shown inside an email (and served "inline"); every other file is only ever downloaded. */
export const SAFE_IMAGE = /^image\/(png|jpe?g|gif|webp)$/i;

// Everything the editor produces is run through this, so a pasted page can never smuggle in scripts.
export const cleanHtml = (html: unknown): string =>
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

/**
 * The plain-text version of an email (what Gmail shows when HTML is off, and the list preview).
 * P2-16 fix: sanitize-html already turns &nbsp; into the no-break space character (U+00A0), so it is replaced as a
 * character too; before, plain-text bodies kept invisible no-break spaces.
 */
export const textOf = (html: unknown): string =>
  sanitizeHtml(String(html || "").replace(/<\/(p|div|h[1-3]|li|tr|blockquote)>|<br\s*\/?>/gi, "\n"), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;| /g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** What the editor sends, cleaned. `to` may be empty while it is a draft; everything is checked when she sends. */
export const emailFields = (b: { toAddr?: string | undefined; ccAddr?: string | undefined; bccAddr?: string | undefined; subject?: string | undefined; html?: string | undefined }) => {
  const html = cleanHtml(b.html);
  return { toAddr: (b.toAddr ?? "").trim(), ccAddr: (b.ccAddr ?? "").trim(), bccAddr: (b.bccAddr ?? "").trim(), subject: (b.subject ?? "").slice(0, 300), html, body: textOf(html) };
};

export const addrList = (s: string) => String(s || "").split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
export const checkAddrs = (label: string, list: string[]) => {
  const bad = list.find((a) => !ADDR.test(a));
  if (bad) throw httpError(400, `"${bad}" is not a valid email address (${label}).`);
};

/** A file name that is safe on every system. */
export const safeFilename = (name: unknown) => String(name || "file").replace(/[\\/:*?"<>|\r\n]+/g, "_").slice(0, 150) || "file";

/** The tags of some HTML, in order: the AI proofreader must give them back exactly. */
export const tagsOf = (html: string) => (String(html).match(/<[^>]+>/g) || []).join("");

/** Points the images in a copied body at the copies of their files (old attachment id -> new id). */
export const repoint = (html: string, ids: Map<number, number>) =>
  html.replace(/\/api\/emails\/attachments\/(\d+)/g, (m, n: string) => (ids.has(Number(n)) ? `/api/emails/attachments/${ids.get(Number(n))}` : m));

/** Images placed in the body travel inside the message (cid:); returns the HTML to send and which files it uses. */
export function inlineImages(html: string, attachmentIds: Set<number>) {
  const used = new Set<number>();
  const out = html.replace(/(<img\b[^>]*?\bsrc=")([^"]*)(")/gi, (m, a: string, src: string, c: string) => {
    const hit = ATT_URL.exec(src);
    const id = hit ? Number(hit[1]) : Number.NaN;
    if (!attachmentIds.has(id)) return m;
    used.add(id);
    return `${a}cid:img${id}@mail${c}`;
  });
  return { html: out, used };
}
