import { createRoute, z } from "@hono/zod-openapi";
import { prompts } from "@hyperfocus/ai";
import { AskBookInput, Book, BookMessage, CreateBookInput, UpdateBookInput } from "@hyperfocus/shared";
import type { AppDeps } from "../../app.ts";
import { IdParam, Ok, body, crudRouter, json, pathId, problem } from "../../http/crud.ts";
import { compact, httpError, orNull } from "../../types.ts";
import { findBook } from "./sources.ts";

// Books (P2-11): the reading list, "find free copies" (./sources.ts) and questions to the AI about one book, kept as a
// conversation. Same answers as the Express routes had, plus the P2 fix: changing or deleting a book that doesn't exist
// is a 404 (it was a 500).

const BOOK_404 = "That book was not found.";
const Asked = z.object({ user: BookMessage, assistant: BookMessage }).openapi("BookAnswer");

/** The summary an earlier "find free copies" search wrote, if any. */
const knownSummary = (result: string) => {
  try {
    const r = result ? JSON.parse(result) : null;
    return r?.summary ? String(r.summary) : "";
  } catch {
    return ""; // no saved search
  }
};

export function booksRouter({ prisma, events, ai }: AppDeps) {
  const app = crudRouter({
    path: "/api/books",
    tag: "Books",
    name: "book",
    item: Book,
    create: CreateBookInput,
    update: UpdateBookInput,
    notFound: BOOK_404,
    store: {
      list: () => prisma.book.findMany({ orderBy: { createdAt: "desc" } }),
      get: (id) => prisma.book.findUnique({ where: { id } }),
      create: ({ title, author, notes }) => prisma.book.create({ data: { title, author, ...compact({ notes }) } }),
      update: async (id, data) => {
        const book = await orNull(prisma.book.update({ where: { id }, data: compact(data) }));
        if (book && data.status === "done") await events.publish("BookFinished", { bookId: book.id, title: book.title });
        return book;
      },
      remove: async (id) => (await prisma.book.deleteMany({ where: { id } })).count > 0, // its conversation goes with it
    },
  });

  // ---------- the conversation about one book ----------
  app.openapi(
    createRoute({ method: "get", path: "/api/books/{id}/chat", tags: ["Books"], summary: "Her questions and the AI's answers, oldest first", request: { params: IdParam }, responses: { 200: json(z.array(BookMessage), "The conversation (empty for a book that doesn't exist)") } }),
    async (c) => c.json(await prisma.bookMessage.findMany({ where: { bookId: pathId(c.req.param("id"), BOOK_404) }, orderBy: { id: "asc" } }), 200),
  );
  app.openapi(
    createRoute({
      method: "post", path: "/api/books/{id}/ask", tags: ["Books"], summary: "AI: ask a question about this book",
      request: { params: IdParam, body: body(AskBookInput) }, responses: { 200: json(Asked, "The question and the answer, both saved"), 400: problem("No question"), 404: problem("No such book") },
    }),
    async (c) => {
      const book = await prisma.book.findUnique({ where: { id: pathId(c.req.param("id"), BOOK_404) } });
      if (!book) throw httpError(404, BOOK_404);
      const { question } = c.req.valid("json");
      const history = (await prisma.bookMessage.findMany({ where: { bookId: book.id }, orderBy: { id: "desc" }, take: 16 })).reverse();
      const helps = (await prisma.profile.findFirst())?.helps || "";
      const reply = (await ai.run(prompts.askAboutBook, { book, knownSummary: knownSummary(book.result), history, question, helps })).trim();
      const user = await prisma.bookMessage.create({ data: { bookId: book.id, role: "user", content: question } });
      const assistant = await prisma.bookMessage.create({ data: { bookId: book.id, role: "assistant", content: reply } });
      return c.json({ user, assistant }, 200);
    },
  );
  app.openapi(
    createRoute({ method: "delete", path: "/api/books/{id}/chat", tags: ["Books"], summary: "Clear the conversation about this book", request: { params: IdParam }, responses: { 200: json(Ok, "Cleared") } }),
    async (c) => {
      await prisma.bookMessage.deleteMany({ where: { bookId: pathId(c.req.param("id"), BOOK_404) } });
      return c.json({ ok: true as const }, 200);
    },
  );

  // ---------- find free copies ----------
  app.openapi(
    createRoute({
      method: "post", path: "/api/books/{id}/find", tags: ["Books"], summary: "Search legal sources for free or cheap copies (saved on the book)",
      request: { params: IdParam }, responses: { 200: json(Book, "The book with the search result"), 404: problem("No such book") },
    }),
    async (c) => {
      const book = await prisma.book.findUnique({ where: { id: pathId(c.req.param("id"), "Book not found.") } });
      if (!book) throw httpError(404, "Book not found.");
      const result = await findBook({ title: book.title, author: book.author }, ai);
      const saved = await prisma.book.update({ where: { id: book.id }, data: { result: JSON.stringify(result), foundAt: new Date(), author: book.author || result.foundAuthor } });
      return c.json(saved, 200);
    },
  );

  return app;
}
