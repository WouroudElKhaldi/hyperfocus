import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorOf } from "../api.ts";
import { useToast } from "../App.tsx";
import More from "../components/More.tsx";
import { Cover, ICON, Pills, STATUS, bookPath, parse, short } from "../components/bookParts.tsx";
import type { Book } from "../types.ts";

// Top-level so the inputs inside keep focus while the page re-renders.
function BookCard({ book, onChange, onDelete }: { book: Book; onChange: (b: Book) => void; onDelete: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ title: book.title, author: book.author });
  const res = useMemo(() => parse(book.result), [book.result]);

  const patch = async (body: Partial<Book>) => onChange(await api.patch<Book>(`/books/${book.id}`, body));
  const find = async () => {
    setBusy(true);
    try { onChange(await api.post<Book>(`/books/${book.id}/find`)); }
    catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
    setBusy(false);
  };
  const saveEdit = async () => {
    if (!f.title.trim()) return;
    await patch({ title: f.title, author: f.author });
    setEditing(false);
  };

  const good = res?.links.filter((l) => ["free", "borrow", "preview", "buy"].includes(l.kind)) || [];
  const info = res?.links.filter((l) => l.kind === "info") || [];
  const best = good.find((l) => l.kind === "free") || good.find((l) => l.kind === "borrow") || good[0];
  const top = [...good, ...info].filter((l) => l !== best).slice(0, 3);

  return (
    <div className="card book">
      <div className="book-head">
        <Link to={bookPath(book)} className="book-cover-link" aria-label={`Open ${book.title}`}><Cover title={book.title} /></Link>
        <div className="book-meta">
          {editing ? (
            <div className="book-edit">
              <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Title" aria-label="Title" />
              <input value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} placeholder="Author (optional)" aria-label="Author" />
              <div className="row">
                <button className="primary" onClick={saveEdit}>Save</button>
                <button className="ghost" onClick={() => { setEditing(false); setF({ title: book.title, author: book.author }); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <Link to={bookPath(book)} className="book-title">{book.title}</Link>
              {book.author && <div className="muted tiny">{book.author}</div>}
            </>
          )}
          <select className={"book-status " + book.status} value={book.status} onChange={(e) => patch({ status: e.target.value })} aria-label="Reading status">
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <More label="More" className="inline book-menu">
          <button className="ghost" onClick={() => setEditing(!editing)}>Edit</button>
          <button className="ghost danger" onClick={onDelete}>Remove</button>
        </More>
      </div>

      <div className="book-actions">
        <Link className="btn primary" to={bookPath(book)}>Open</Link>
        <button disabled={busy} onClick={find}>{busy ? "Searching… (up to 30s)" : res ? "Search again" : "Find links and PDFs"}</button>
      </div>

      {res && (
        <div className="book-res">
          {best && <a className="btn" href={best.url} target="_blank" rel="noopener noreferrer" title={best.label}>{ICON[best.kind]} {short(best)}</a>}
          {top.length > 0 && <Pills items={top} />}
          {!best && <p className="muted tiny">No free legal copy found. Open the book to see more places to look.</p>}
        </div>
      )}
    </div>
  );
}

export default function Books() {
  const toast = useToast();
  const [books, setBooks] = useState<Book[]>([]);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => { api.get<Book[]>("/books").then(setBooks).catch((e) => toast(e.message, "err")); }, []);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const b = await api.post<Book>("/books", { title, author });
      setBooks([b, ...books]); setTitle(""); setAuthor("");
    } catch (caught) { const err = errorOf(caught); toast(err.message, "err"); }
  };
  const replace = (b: Book) => setBooks((l) => l.map((x) => (x.id === b.id ? b : x)));
  const remove = async (b: Book) => {
    if (!confirm(`Remove "${b.title}" from your list?`)) return;
    await api.del(`/books/${b.id}`);
    setBooks((l) => l.filter((x) => x.id !== b.id));
  };

  const shown = books.filter((b) => filter === "all" || b.status === filter);
  const count = (k: string) => books.filter((b) => k === "all" || b.status === k).length;

  return (
    <>
      <h1>Books</h1>
      <p className="sub">Add a book, then open it to find free copies, read what the AI found, and ask it questions.</p>

      <form className="card row" onSubmit={add}>
        <input className="grow" placeholder="Book title…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="grow" placeholder="Author (optional)" value={author} onChange={(e) => setAuthor(e.target.value)} />
        <button className="primary" disabled={!title.trim()}>Add</button>
      </form>

      <div className="tabs">
        {[["all", "All"] as [string, string], ...Object.entries(STATUS)].map(([k, v]) => (
          <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{v} ({count(k)})</button>
        ))}
      </div>

      {shown.length === 0 && <div className="empty">{books.length ? "Nothing here." : "No books yet. What do you want to read next?"}</div>}
      <div className="book-grid">
        {shown.map((b) => <BookCard key={b.id} book={b} onChange={replace} onDelete={() => remove(b)} />)}
      </div>
    </>
  );
}
