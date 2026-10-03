import { prompts } from "@hyperfocus/ai";
import type { AiGateway } from "@hyperfocus/ai";
import { z } from "zod";
import { config } from "../../config.ts";
import { errorInfo } from "../../types.ts";

// "Find free copies" (P2-11): looks up real, legal sources. The AI never invents URLs: every link comes from a book
// site's reply. Each site's reply is read with a Zod schema (Anti-Corruption Layer), so a site changing its format
// gives fewer results, never a crash or a broken link.

const UA = { "User-Agent": "Hyperfocus/1.0 (personal local app)" };
const q = encodeURIComponent;

// BOOK_SOURCES_URL (tests only) replaces all three sites with one local fake: <url>/openlibrary/…, <url>/google/…, <url>/gutendex/…
const fake = config.bookSourcesUrl.replace(/\/+$/, "");
const SITES = {
  openLibrary: { name: "Open Library", base: fake ? `${fake}/openlibrary` : "https://openlibrary.org" },
  googleBooks: { name: "Google Books", base: fake ? `${fake}/google` : "https://www.googleapis.com" },
  gutenberg: { name: "Project Gutenberg", base: fake ? `${fake}/gutendex` : "https://gutendex.com" },
};
type Site = (typeof SITES)[keyof typeof SITES];

/** One place to find a book: a link plus what kind of access it gives. */
export type LinkKind = "free" | "borrow" | "preview" | "buy" | "info";
export type Link = { kind: LinkKind; label: string; url: string };
type Candidate = { source: string; title: string; authors: string[]; year: string | number | undefined; links: Link[] };

// ---------- what the sites send back (only the fields used; everything optional, unknown fields ignored) ----------
const str = z.string().optional().catch(undefined);
const strs = z.array(z.string()).optional().catch(undefined);
const list = <T extends z.ZodType>(item: T) => z.array(z.unknown()).optional().catch(undefined).transform((xs) => (xs ?? []).flatMap((x) => {
  const r = item.safeParse(x);
  return r.success ? [r.data as z.output<T>] : []; // a malformed entry is skipped, the others are kept
}));

const OpenLibraryReply = z.object({
  docs: list(z.object({ key: z.string(), title: z.string(), author_name: strs, first_publish_year: z.number().optional().catch(undefined), ia: strs, ebook_access: str })),
});
const GoogleBooksReply = z.object({
  items: list(z.object({
    volumeInfo: z.object({ title: z.string(), authors: strs, publishedDate: str, previewLink: str, infoLink: str }),
    accessInfo: z.object({ viewability: str, webReaderLink: str, pdf: z.object({ isAvailable: z.boolean().optional(), downloadLink: str }).optional().catch(undefined) }).optional().catch(undefined),
    saleInfo: z.object({ buyLink: str, listPrice: z.object({ amount: z.number(), currencyCode: z.string() }).optional().catch(undefined) }).optional().catch(undefined),
  })),
});
const GutendexReply = z.object({
  results: list(z.object({ id: z.number(), title: z.string(), authors: list(z.object({ name: z.string() })), formats: z.record(z.string(), z.string()).optional().catch(undefined) })),
});

async function get<T extends z.ZodType>(site: Site, path: string, schema: T, ms = 9000, retries = 1): Promise<z.output<T>> {
  try {
    const r = await fetch(`${site.base}${path}`, { headers: UA, signal: AbortSignal.timeout(ms) });
    if (r.status === 429 && retries > 0) { // rate limited: wait a moment and try once more
      await new Promise((ok) => setTimeout(ok, 1500));
      return get(site, path, schema, ms, retries - 1);
    }
    if (!r.ok) throw new Error(r.status === 429 ? "is busy right now" : `answered ${r.status}`);
    const reply = schema.safeParse(await r.json());
    if (!reply.success) throw new Error("sent something unexpected");
    return reply.data;
  } catch (e) {
    const err = errorInfo(e);
    const why = err.name === "TimeoutError" ? "was too slow" : err.message;
    throw new Error(`${site.name} ${why}`);
  }
}

async function openLibrary(title: string, author: string): Promise<Candidate[]> {
  const d = await get(SITES.openLibrary, `/search.json?title=${q(title)}${author ? `&author=${q(author)}` : ""}&limit=5&fields=key,title,author_name,first_publish_year,ia,ebook_access`, OpenLibraryReply);
  return d.docs.map((x) => {
    const ia = x.ia?.[0];
    const links: Link[] = [];
    if (ia && x.ebook_access === "public") links.push({ kind: "free", label: "Read or download free (Internet Archive)", url: `https://archive.org/details/${ia}` });
    else if (ia && x.ebook_access === "borrowable") links.push({ kind: "borrow", label: "Borrow for free (Internet Archive, free account)", url: `https://archive.org/details/${ia}` });
    links.push({ kind: "info", label: "Open Library page", url: `https://openlibrary.org${x.key}` });
    return { source: SITES.openLibrary.name, title: x.title, authors: x.author_name ?? [], year: x.first_publish_year, links };
  });
}

async function googleBooks(title: string, author: string): Promise<Candidate[]> {
  const query = q(`intitle:${title}`) + (author ? `+${q(`inauthor:${author}`)}` : "");
  // an optional free API key (GOOGLE_BOOKS_API_KEY in .env) avoids Google's strict limits for keyless requests
  const key = config.googleBooksApiKey ? `&key=${q(config.googleBooksApiKey)}` : ""; // always empty in the demo
  const d = await get(SITES.googleBooks, `/books/v1/volumes?q=${query}&maxResults=5&printType=books${key}`, GoogleBooksReply, 9000, 2);
  return d.items.map(({ volumeInfo: v, accessInfo: a, saleInfo: s }) => {
    const links: Link[] = [];
    if (a?.pdf?.isAvailable && a.pdf.downloadLink) links.push({ kind: "free", label: "Free PDF (Google Books)", url: a.pdf.downloadLink });
    if (a?.viewability === "ALL_PAGES" && a.webReaderLink) links.push({ kind: "free", label: "Read free online (Google Books)", url: a.webReaderLink });
    else if (a?.viewability === "PARTIAL" && v.previewLink) links.push({ kind: "preview", label: "Free preview (Google Books)", url: v.previewLink });
    if (s?.buyLink) links.push({ kind: "buy", label: `Buy${s.listPrice ? ` (${s.listPrice.amount} ${s.listPrice.currencyCode})` : ""} on Google Play Books`, url: s.buyLink });
    if (!links.length && v.infoLink) links.push({ kind: "info", label: "Google Books page", url: v.infoLink });
    return { source: SITES.googleBooks.name, title: v.title, authors: v.authors ?? [], year: (v.publishedDate ?? "").slice(0, 4), links };
  });
}

async function gutenberg(title: string, author: string): Promise<Candidate[]> {
  const d = await get(SITES.gutenberg, `/books/?search=${q(author ? `${title} ${author}` : title)}`, GutendexReply, 20000);
  return d.results.slice(0, 3).map((b) => {
    const links: Link[] = [{ kind: "free", label: "Free (Project Gutenberg, public domain)", url: `https://www.gutenberg.org/ebooks/${b.id}` }];
    const pdf = b.formats?.["application/pdf"];
    if (pdf) links.push({ kind: "free", label: "Free PDF (Project Gutenberg)", url: pdf });
    return { source: SITES.gutenberg.name, title: b.title, authors: b.authors.map((x) => x.name), year: "", links };
  });
}

// Always-available, legitimate places to look next
function moreLinks(title: string, author: string): Link[] {
  const term = q(`${title} ${author}`.trim());
  return [
    { kind: "borrow", label: "Find it in a library near you (WorldCat)", url: `https://search.worldcat.org/search?q=${term}` },
    { kind: "borrow", label: "Search the Internet Archive", url: `https://archive.org/search?query=${term}` },
    { kind: "info", label: "Reviews on Goodreads", url: `https://www.goodreads.com/search?q=${term}` },
    { kind: "buy", label: "Search Amazon", url: `https://www.amazon.com/s?k=${term}` },
  ];
}

export async function findBook({ title, author }: { title: string; author: string }, ai: AiGateway) {
  const settled = await Promise.allSettled([openLibrary(title, author), googleBooks(title, author), gutenberg(title, author)]);
  const errors = settled.filter((s) => s.status === "rejected").map((s) => errorInfo(s.reason).message);
  const candidates = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : [])).map((c, i) => ({ ...c, id: i }));

  // The AI only judges which results are really this book and writes a summary. It never supplies links.
  let summary = "", whyForYou = "", foundAuthor = "", keep = candidates, aiNote = "";
  try {
    const out = await ai.run(prompts.matchBook, { title, author, candidates });
    const matchIds = out.matchIds;
    if (matchIds) keep = candidates.filter((c) => matchIds.includes(c.id));
    ({ summary, whyForYou, author: foundAuthor } = out);
  } catch (e) {
    aiNote = `AI step skipped: ${errorInfo(e).message}`;
  }

  // flatten, dedupe by url, best kinds first
  const order: Record<LinkKind, number> = { free: 0, borrow: 1, preview: 2, buy: 3, info: 4 };
  const seen = new Set<string>();
  const links = keep
    .flatMap((c) => c.links.map((l) => ({ ...l, source: c.source, matched: `${c.title}${c.authors.length ? ` - ${c.authors[0]}` : ""}` })))
    .filter((l) => !seen.has(l.url) && seen.add(l.url))
    .sort((a, b) => order[a.kind] - order[b.kind]);

  return {
    summary, whyForYou, foundAuthor, links, more: moreLinks(title, author),
    sourcesFailed: errors, aiNote, searchedAt: new Date().toISOString(),
  };
}
