import { chat } from "./ai.js";

// Looks up real, legal sources. The AI never invents URLs: every link below comes from an API response.
const UA = { "User-Agent": "Hyperfocus/1.0 (personal local app)" };
const q = encodeURIComponent;

const NAMES = { "openlibrary.org": "Open Library", "www.googleapis.com": "Google Books", "gutendex.com": "Project Gutenberg" };

async function get(url, ms = 9000, retries = 1) {
  const host = new URL(url).host;
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
    if (r.status === 429 && retries > 0) { // rate limited: wait a moment and try once more
      await new Promise((ok) => setTimeout(ok, 1500));
      return get(url, ms, retries - 1);
    }
    if (!r.ok) throw new Error(r.status === 429 ? "is busy right now" : `answered ${r.status}`);
    return r.json();
  } catch (e) {
    const why = e.name === "TimeoutError" ? "was too slow" : e.message;
    throw new Error(`${NAMES[host] || host} ${why}`);
  }
}

async function openLibrary(title, author) {
  const d = await get(`https://openlibrary.org/search.json?title=${q(title)}${author ? `&author=${q(author)}` : ""}&limit=5&fields=key,title,author_name,first_publish_year,ia,ebook_access`);
  return (d.docs || []).map((x) => {
    const ia = (x.ia || [])[0];
    const links = [];
    if (ia && x.ebook_access === "public") links.push({ kind: "free", label: "Read or download free (Internet Archive)", url: `https://archive.org/details/${ia}` });
    else if (ia && x.ebook_access === "borrowable") links.push({ kind: "borrow", label: "Borrow for free (Internet Archive, free account)", url: `https://archive.org/details/${ia}` });
    links.push({ kind: "info", label: "Open Library page", url: `https://openlibrary.org${x.key}` });
    return { source: "Open Library", title: x.title, authors: x.author_name || [], year: x.first_publish_year, links };
  });
}

async function googleBooks(title, author) {
  const query = q(`intitle:${title}`) + (author ? "+" + q(`inauthor:${author}`) : "");
  // an optional free API key (GOOGLE_BOOKS_API_KEY in .env) avoids Google's strict limits for keyless requests
  const key = !process.env.DEMO_MODE && process.env.GOOGLE_BOOKS_API_KEY ? `&key=${q(process.env.GOOGLE_BOOKS_API_KEY)}` : "";
  const d = await get(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=5&printType=books${key}`, 9000, 2);
  return (d.items || []).map((it) => {
    const v = it.volumeInfo || {}, a = it.accessInfo || {}, s = it.saleInfo || {};
    const links = [];
    if (a.pdf?.isAvailable && a.pdf.downloadLink) links.push({ kind: "free", label: "Free PDF (Google Books)", url: a.pdf.downloadLink });
    if (a.viewability === "ALL_PAGES" && a.webReaderLink) links.push({ kind: "free", label: "Read free online (Google Books)", url: a.webReaderLink });
    else if (a.viewability === "PARTIAL" && v.previewLink) links.push({ kind: "preview", label: "Free preview (Google Books)", url: v.previewLink });
    if (s.buyLink) links.push({ kind: "buy", label: `Buy${s.listPrice ? ` (${s.listPrice.amount} ${s.listPrice.currencyCode})` : ""} on Google Play Books`, url: s.buyLink });
    if (!links.length && v.infoLink) links.push({ kind: "info", label: "Google Books page", url: v.infoLink });
    return { source: "Google Books", title: v.title, authors: v.authors || [], year: (v.publishedDate || "").slice(0, 4), links };
  });
}

async function gutenberg(title, author) {
  const d = await get(`https://gutendex.com/books/?search=${q(author ? `${title} ${author}` : title)}`, 20000);
  return (d.results || []).slice(0, 3).map((b) => {
    const links = [{ kind: "free", label: "Free (Project Gutenberg, public domain)", url: `https://www.gutenberg.org/ebooks/${b.id}` }];
    if (b.formats?.["application/pdf"]) links.push({ kind: "free", label: "Free PDF (Project Gutenberg)", url: b.formats["application/pdf"] });
    return { source: "Project Gutenberg", title: b.title, authors: (b.authors || []).map((x) => x.name), year: "", links };
  });
}

// Always-available, legitimate places to look next
function moreLinks(title, author) {
  const term = q(`${title} ${author}`.trim());
  return [
    { kind: "borrow", label: "Find it in a library near you (WorldCat)", url: `https://search.worldcat.org/search?q=${term}` },
    { kind: "borrow", label: "Search the Internet Archive", url: `https://archive.org/search?query=${term}` },
    { kind: "info", label: "Reviews on Goodreads", url: `https://www.goodreads.com/search?q=${term}` },
    { kind: "buy", label: "Search Amazon", url: `https://www.amazon.com/s?k=${term}` },
  ];
}

export async function findBook({ title, author }) {
  const settled = await Promise.allSettled([openLibrary(title, author), googleBooks(title, author), gutenberg(title, author)]);
  const errors = settled.filter((s) => s.status === "rejected").map((s) => s.reason.message);
  const candidates = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : [])).map((c, i) => ({ ...c, id: i }));

  // The AI only judges which results are really this book and writes a summary. It never supplies links.
  let summary = "", whyForYou = "", foundAuthor = "", keep = candidates, aiNote = "";
  try {
    const out = await chat(
      [
        {
          role: "system",
          content: `You help a software engineer (3 years of experience, moving from mid to senior) find books. You get the book she wants and a list of search results.
Return ONLY JSON: {"matchIds": number[], "author": string, "summary": string, "whyForYou": string}.
- matchIds: ids of results that are really this book (same work; other editions are fine). Exclude different books, study guides, summaries by other people, and other books with similar titles.
- author: the book's main author if you are confident, else "".
- summary: 2-3 plain sentences on what the book is about. If you are not sure what the book is, say so instead of guessing.
- whyForYou: one sentence on why it could help a mid-level software engineer growing to senior, or "" if it isn't relevant.
Never invent facts, quotes or links.`,
        },
        {
          role: "user",
          content: `Book: "${title}"${author ? ` by ${author}` : ""}\nResults:\n${candidates.map((c) => `${c.id}: "${c.title}" by ${c.authors.join(", ") || "?"} (${c.year || "?"}) [${c.source}]`).join("\n") || "(none)"}`,
        },
      ],
      { json: true, temperature: 0.2 },
    );
    if (Array.isArray(out.matchIds)) keep = candidates.filter((c) => out.matchIds.includes(c.id));
    summary = String(out.summary ?? "");
    whyForYou = String(out.whyForYou ?? "");
    foundAuthor = String(out.author ?? "");
  } catch (e) {
    aiNote = `AI step skipped: ${e.message}`;
  }

  // flatten, dedupe by url, best kinds first
  const order = { free: 0, borrow: 1, preview: 2, buy: 3, info: 4 };
  const seen = new Set();
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
const ASK = `You answer questions about ONE book for a software engineer (about 3 years of experience, growing from mid to senior) who has ADHD/autism traits. Be clear and short: 2 to 6 sentences unless she asks for more, plain words, concrete examples. If she asks for a list, give 3 to 5 items.
Be honest about what you know. Say plainly when you are not sure. NEVER invent quotes, page numbers, chapter titles, statistics or details about the book. You may use what you reliably know about the book and its ideas, and what she wrote in her own notes.
If the question is not about this book, reading or learning, gently bring it back. Do not repeat a long summary unless she asks. Answer in the language of her question.`;

export async function askAboutBook({ book, result, history, question, helps }) {
  let known = "";
  try { const r = result ? JSON.parse(result) : null; if (r?.summary) known = `A summary written earlier by an AI (it may be wrong): ${r.summary}`; } catch { /* no saved search */ }
  const context = `The book: "${book.title}"${book.author ? ` by ${book.author}` : ""}. Her status: ${book.status === "done" ? "finished it" : book.status === "reading" ? "reading it now" : "wants to read it"}.${book.notes ? ` Her own notes: ${book.notes}` : ""} ${known}${helps ? `\nWhat helps her, in her own words: ${helps}` : ""}`;
  const messages = [
    { role: "system", content: `${ASK}\n\n${context}` },
    ...history.slice(-16).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: question },
  ];
  return (await chat(messages, { temperature: 0.5 })).trim();
}
