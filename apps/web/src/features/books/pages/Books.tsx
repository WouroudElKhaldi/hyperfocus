import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { type FormEvent, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import More from "../../../components/More.tsx";
import { Cover, ICON, Pills, STATUS, bookPath, bookSlug, parse, short } from "../components/bookParts.tsx";
import type { Book } from "../../../types.ts";
import { useAddBook, useBookChanges, useBooks, useDeleteBook } from "../api.ts";

// Top-level so the inputs inside keep focus while the page re-renders.
function BookCard({ book, onDelete }: { book: Book; onDelete: () => void }) {
  const change = useBookChanges(book.id);
  const busy = change.find.isPending;
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ title: book.title, author: book.author });
  const res = useMemo(() => parse(book.result), [book.result]);

  const patch = (body: Parameters<typeof change.update.mutate>[0], onDone?: () => void) => change.update.mutate(body, { onSuccess: () => onDone?.() });
  const find = () => change.find.mutate();
  const saveEdit = () => {
    if (f.title.trim()) patch({ title: f.title, author: f.author }, () => setEditing(false));
  };

  const good = res?.links.filter((l) => ["free", "borrow", "preview", "buy"].includes(l.kind)) || [];
  const info = res?.links.filter((l) => l.kind === "info") || [];
  const best = good.find((l) => l.kind === "free") || good.find((l) => l.kind === "borrow") || good[0];
  const top = [...good, ...info].filter((l) => l !== best).slice(0, 3);

  return (
    <div className="card book">
      <div className="book-head">
        <Link to="/books/$slug" params={{ slug: bookSlug(book) }} className="book-cover-link" aria-label={`Open ${book.title}`}><Cover title={book.title} /></Link>
        <div className="book-meta">
          {editing ? (
            <div className="book-edit">
              <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={i18next.t("books.title")} aria-label={i18next.t("books.title")} />
              <input value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} placeholder={i18next.t("books.authorOptional")} aria-label={i18next.t("books.author")} />
              <div className="row">
                <button className="primary" onClick={saveEdit}>{i18next.t("books.save")}</button>
                <button className="ghost" onClick={() => { setEditing(false); setF({ title: book.title, author: book.author }); }}>{i18next.t("books.cancel")}</button>
              </div>
            </div>
          ) : (
            <>
              <Link to="/books/$slug" params={{ slug: bookSlug(book) }} className="book-title">{book.title}</Link>
              {book.author && <div className="muted tiny">{book.author}</div>}
            </>
          )}
          <select className={"book-status " + book.status} value={book.status} onChange={(e) => patch({ status: e.target.value })} aria-label={i18next.t("books.readingStatus")}>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <More label={i18next.t("books.more")} className="inline book-menu">
          <button className="ghost" onClick={() => setEditing(!editing)}>{i18next.t("books.edit")}</button>
          <button className="ghost danger" onClick={onDelete}>{i18next.t("books.remove")}</button>
        </More>
      </div>

      <div className="book-actions">
        <Link className="btn primary" to="/books/$slug" params={{ slug: bookSlug(book) }}>{i18next.t("books.open")}</Link>
        <button disabled={busy} onClick={find}>{busy ? i18next.t("books.searchingUpTo30s") : res ? i18next.t("books.searchAgain") : i18next.t("books.findLinksAndPdfs")}</button>
      </div>

      {res && (
        <div className="book-res">
          {best && <a className="btn" href={best.url} target="_blank" rel="noopener noreferrer" title={best.label}>{ICON[best.kind]} {short(best)}</a>}
          {top.length > 0 && <Pills items={top} />}
          {!best && <p className="muted tiny">{i18next.t("books.noFreeLegalCopy")}</p>}
        </div>
      )}
    </div>
  );
}

export default function Books() {
  useTranslation(); // (re-renders this page when the language changes)
  const books = useBooks().data ?? [];
  const addBook = useAddBook();
  const deleteBook = useDeleteBook();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [filter, setFilter] = useState("all");

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addBook.mutate({ title, author }, { onSuccess: () => { setTitle(""); setAuthor(""); } });
  };
  const remove = (b: Book) => { if (confirm(i18next.t("books.removeAsk", { title: b.title }))) deleteBook.mutate(b.id); };

  const shown = books.filter((b) => filter === "all" || b.status === filter);
  const count = (k: string) => books.filter((b) => k === "all" || b.status === k).length;

  return (
    <>
      <h1>{i18next.t("books.books")}</h1>
      <p className="sub">{i18next.t("books.addABookThen")}</p>

      <form className="card row" onSubmit={add}>
        <input className="grow" placeholder={i18next.t("books.bookTitle")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="grow" placeholder={i18next.t("books.authorOptional")} value={author} onChange={(e) => setAuthor(e.target.value)} />
        <button className="primary" disabled={!title.trim()}>{i18next.t("books.add")}</button>
      </form>

      <div className="tabs">
        {[["all", "All"] as [string, string], ...Object.entries(STATUS)].map(([k, v]) => (
          <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{v} ({count(k)})</button>
        ))}
      </div>

      {shown.length === 0 && <div className="empty">{books.length ? i18next.t("books.nothingHere") : i18next.t("books.noBooksYetWhat")}</div>}
      <div className="book-grid">
        {shown.map((b) => <BookCard key={b.id} book={b} onDelete={() => remove(b)} />)}
      </div>
    </>
  );
}
