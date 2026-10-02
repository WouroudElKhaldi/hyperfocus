import type { AiMessage } from "../types.ts";
import { jsonTemplate, lenient, object, systemAndUser, text, textTemplate } from "../template.ts";

// Books: judge which search results are really the book she wants, and answer her questions about one book.

export type BookCandidate = { id: number; title: string; authors: string[]; year?: string | number | undefined; source: string };

export const matchBook = jsonTemplate({
  name: "matchBook",
  temperature: 0.2,
  messages: ({ title, author, candidates }: { title: string; author: string; candidates: BookCandidate[] }) =>
    systemAndUser(
      `You help a software engineer (3 years of experience, moving from mid to senior) find books. You get the book she wants and a list of search results.
Return ONLY JSON: {"matchIds": number[], "author": string, "summary": string, "whyForYou": string}.
- matchIds: ids of results that are really this book (same work; other editions are fine). Exclude different books, study guides, summaries by other people, and other books with similar titles.
- author: the book's main author if you are confident, else "".
- summary: 2-3 plain sentences on what the book is about. If you are not sure what the book is, say so instead of guessing.
- whyForYou: one sentence on why it could help a mid-level software engineer growing to senior, or "" if it isn't relevant.
Never invent facts, quotes or links.`,
      `Book: "${title}"${author ? ` by ${author}` : ""}\nResults:\n${candidates.map((c) => `${c.id}: "${c.title}" by ${c.authors.join(", ") || "?"} (${c.year || "?"}) [${c.source}]`).join("\n") || "(none)"}`,
    ),
  // matchIds: null when the AI gave no list (then every result is kept)
  reply: object({ matchIds: lenient((v) => (Array.isArray(v) ? v.map(Number) : null)), author: text(), summary: text(), whyForYou: text() }),
});

const ASK = `You answer questions about ONE book for a software engineer (about 3 years of experience, growing from mid to senior) who has ADHD/autism traits. Be clear and short: 2 to 6 sentences unless she asks for more, plain words, concrete examples. If she asks for a list, give 3 to 5 items.
Be honest about what you know. Say plainly when you are not sure. NEVER invent quotes, page numbers, chapter titles, statistics or details about the book. You may use what you reliably know about the book and its ideas, and what she wrote in her own notes.
If the question is not about this book, reading or learning, gently bring it back. Do not repeat a long summary unless she asks. Answer in the language of her question.`;

export type BookQuestion = {
  book: { title: string; author: string; status: string; notes: string };
  /** A summary an earlier search wrote, if any. */
  knownSummary: string;
  history: AiMessage[];
  question: string;
  helps: string;
};

export const askAboutBook = textTemplate({
  name: "askAboutBook",
  temperature: 0.5,
  messages: ({ book, knownSummary, history, question, helps }: BookQuestion) => {
    const known = knownSummary ? `A summary written earlier by an AI (it may be wrong): ${knownSummary}` : "";
    const context = `The book: "${book.title}"${book.author ? ` by ${book.author}` : ""}. Her status: ${book.status === "done" ? "finished it" : book.status === "reading" ? "reading it now" : "wants to read it"}.${book.notes ? ` Her own notes: ${book.notes}` : ""} ${known}${helps ? `\nWhat helps her, in her own words: ${helps}` : ""}`;
    return [
      { role: "system", content: `${ASK}\n\n${context}` },
      ...history.slice(-16).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: question },
    ];
  },
});
