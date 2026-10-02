import type { Book } from "@hyperfocus/db";
import { prompts } from "@hyperfocus/ai";
import { type AiMessage, ai } from "./ai.ts";
import { config } from "./config.ts";
import { errorInfo, type UncheckedJson } from "./types.ts";

// Looks up real, legal sources. The AI never invents URLs: every link below comes from an API response.
const UA = { "User-Agent": "Hyperfocus/1.0 (personal local app)" };
const q = encodeURIComponent;

const NAMES: Record<string, string> = { "openlibrary.org": "Open Library", "www.googleapis.com": "Google Books", "gutendex.com": "Project Gutenberg" };

/** One place to find a book: a link plus what kind of access it gives. */
type LinkKind = "free" | "borrow" | "preview" | "buy" | "info";
type Link = { kind: LinkKind; label: string; url: string };
type Candidate = { source: string; title: string; authors: string[]; year: string | number | undefined; links: Link[] };

// TODO(types): the book sites' replies get Zod schemas (and a fake for tests) in P2-11. Until then they are read loosely.
async function get(url: string, ms = 9000, retries = 1): Promise<UncheckedJson> {
  const host = new URL(url).host;
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
    if (r.status === 429 && retries > 0) { // rate limited: wait a moment and try once more
      await new Promise((ok) => setTimeout(ok, 1500));
      return get(url, ms, retries - 1);
    }
    if (!r.ok) throw new Error(r.status === 429 ? "is busy right now" : `answered ${r.status}`);
    return (await r.json()) as UncheckedJson;
  } catch (e) {
    const err = errorInfo(e);
    const why = err.name === "TimeoutError" ? "was too slow" : err.message;
    throw new Error(`${NAMES[host] || host} ${why}`);
  }
}

async function openLibrary(title: string, author: string): Promise<Candidate[]> {
  const d = await get(`https://openlibrary.org/search.json?title=${q(title)}${author ? `&author=${q(author)}` : ""}&limit=5&fields=key,title,author_name,first_publish_year,ia,ebook_access`);
  return ((d.docs || []) as UncheckedJson[]).map((x) => {
    const ia = (x.ia || [])[0];
    const links: Link[] = [];
    if (ia && x.ebook_access === "public") links.push({ kind: "free", label: "Read or download free (Internet Archive)", url: `https://archive.org/details/${ia}` });
    else if (ia && x.ebook_access === "borrowable") links.push({ kind: "borrow", label: "Borrow for free (Internet Archive, free account)", url: `https://archive.org/details/${ia}` });
    links.push({ kind: "info", label: "Open Library page", url: `https://openlibrary.org${x.key}` });
    return { source: "Open Library", title: x.title, authors: x.author_name || [], year: x.first_publish_year, links };
  });
}

async function googleBooks(title: string, author: string): Promise<Candidate[]> {
  const query = q(`intitle:${title}`) + (author ? "+" + q(`inauthor:${author}`) : "");
  // an optional free API key (GOOGLE_BOOKS_API_KEY in .env) avoids Google's strict limits for keyless requests
  const key = config.googleBooksApiKey ? `&key=${q(config.googleBooksApiKey)}` : ""; // always empty in the demo
  const d = await get(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=5&printType=books${key}`, 9000, 2);
  return ((d.items || []) as UncheckedJson[]).map((it) => {
    const v = it.volumeInfo || {}, a = it.accessInfo || {}, s = it.saleInfo || {};
    const links: Link[] = [];
    if (a.pdf?.isAvailable && a.pdf.downloadLink) links.push({ kind: "free", label: "Free PDF (Google Books)", url: a.pdf.downloadLink });
    if (a.viewability === "ALL_PAGES" && a.webReaderLink) links.push({ kind: "free", label: "Read free online (Google Books)", url: a.webReaderLink });
    else if (a.viewability === "PARTIAL" && v.previewLink) links.push({ kind: "preview", label: "Free preview (Google Books)", url: v.previewLink });
    if (s.buyLink) links.push({ kind: "buy", label: `Buy${s.listPrice ? ` (${s.listPrice.amount} ${s.listPrice.currencyCode})` : ""} on Google Play Books`, url: s.buyLink });
    if (!links.length && v.infoLink) links.push({ kind: "info", label: "Google Books page", url: v.infoLink });
    return { source: "Google Books", title: v.title, authors: v.authors || [], year: (v.publishedDate || "").slice(0, 4), links };
  });
}

async function gutenberg(title: string, author: string): Promise<Candidate[]> {
  const d = await get(`https://gutendex.com/books/?search=${q(author ? `${title} ${author}` : title)}`, 20000);
  return ((d.results || []) as UncheckedJson[]).slice(0, 3).map((b) => {
    const links: Link[] = [{ kind: "free", label: "Free (Project Gutenberg, public domain)", url: `https://www.gutenberg.org/ebooks/${b.id}` }];
    if (b.formats?.["application/pdf"]) links.push({ kind: "free", label: "Free PDF (Project Gutenberg)", url: b.formats["application/pdf"] });
    return { source: "Project Gutenberg", title: b.title, authors: ((b.authors || []) as UncheckedJson[]).map((x) => x.name), year: "", links };
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

export async function findBook({ title, author }: { title: string; author: string }) {
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
    .flatMap((c) => c.links.map((l) => ({ ...l, source: c.source, matched: `${c.title}${c.authors.length ? " - " + c.authors[0] : ""}` })))
    .filter((l) => !seen.has(l.url) && seen.add(l.url))
    .sort((a, b) => order[a.kind] - order[b.kind]);

  return {
    summary, whyForYou, foundAuthor, links, more: moreLinks(title, author),
    sourcesFailed: errors, aiNote, searchedAt: new Date().toISOString(),
  };
}

// ---------- asking the AI about one book ----------
export async function askAboutBook({ book, result, history, question, helps }: {
  book: Pick<Book, "title" | "author" | "status" | "notes">;
  result: string;
  history: AiMessage[];
  question: string;
  helps: string;
}): Promise<string> {
  let knownSummary = "";
  try { const r = result ? JSON.parse(result) : null; if (r?.summary) knownSummary = String(r.summary); } catch { /* no saved search */ }
  return (await ai.run(prompts.askAboutBook, { book, knownSummary, history, question, helps })).trim();
}
