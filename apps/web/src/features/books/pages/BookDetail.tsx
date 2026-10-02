import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { errorOf } from "../../../api.ts";
import { useToast } from "../../../App.tsx";
import LoadProblem, { notFound } from "../../../components/LoadProblem.tsx";
import More from "../../../components/More.tsx";
import { useAskBook, useBook, useBookChanges, useBookChat, useClearBookChat, useDeleteBook } from "../api.ts";
import { Cover, ICON, STATUS, bookPath, bookSlug, parse } from "../components/bookParts.tsx";
import type { Book, BookLink } from "../../../types.ts";


const QUESTIONS = [
  "Give me a 5-minute overview",
  "What are the 3 most useful ideas?",
  "Is it worth my time right now?",
  "Where should I start reading?",
  "Quiz me with 3 questions",
];

const ORDER = ["free", "borrow", "preview", "buy", "info"];
const GROUP: Record<string, string> = { free: "Free to read or download", borrow: "Borrow for free", preview: "Previews", buy: "Buy it", info: "Learn more" };

function Ask({ book }: { book: Book }) {
  const msgs = useBookChat(book.id).data ?? null;
  const ask = useAskBook(book.id);
  const clearChat = useClearBookChat(book.id);
  const busy = ask.isPending;
  const [text, setText] = useState("");
  const [confirm, setConfirm] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

  // the question shows at once; if the AI fails it goes back into the box (and the reason shows in a toast)
  const send = (q = text) => {
    const question = q.trim();
    if (!question || busy) return;
    setText("");
    ask.mutate(question, { onError: () => setText(question), onSettled: () => box.current?.focus() });
  };
  const clear = () => clearChat.mutate(undefined, { onSuccess: () => setConfirm(false) });

  return (
    <section className="card book-ask" aria-label="Ask the AI about this book">
      <div className="book-ask-head">
        <h2>Ask about this book</h2>
        {(msgs?.length ?? 0) > 0 && (confirm
          ? <span className="row"><button className="danger-btn tiny-btn" onClick={clear}>Clear it</button><button className="ghost tiny-btn" onClick={() => setConfirm(false)}>Keep</button></span>
          : <button className="ghost tiny-btn" onClick={() => setConfirm(true)}>Clear chat</button>)}
      </div>
      <div className="chat-log book-chat-log" aria-live="polite">
        {msgs === null && <div className="empty">Loading…</div>}
        {msgs?.length === 0 && (
          <div className="chat-empty">
            <p className="muted">Ask anything about <b>{book.title}</b>. Your questions and the answers are saved here.</p>
            <div className="chip-row">{QUESTIONS.map((q) => <button key={q} className="trait" onClick={() => send(q)}>{q}</button>)}</div>
          </div>
        )}
        {msgs?.map((m) => <div key={m.id} className={"bubble-row " + m.role}><div className={"msg " + m.role}>{m.content}</div></div>)}
        {busy && <div className="bubble-row assistant"><div className="msg assistant typing" aria-label="Thinking"><i /><i /><i /></div></div>}
        <div ref={end} />
      </div>
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <textarea ref={box} rows={1} placeholder="Ask about this book…" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} aria-label="Your question" />
        <button className="primary" disabled={!text.trim() || busy}>Ask</button>
      </form>
      <p className="muted tiny book-ask-note">The AI answers from what it knows and can be wrong. It is asked not to invent quotes or page numbers.</p>
    </section>
  );
}

export default function BookDetail() {
  const toast = useToast();
  const nav = useNavigate();
  const { slug } = useParams({ from: "/books/$slug" });
  const bookId = parseInt(slug ?? "", 10);
  const bookQuery = useBook(bookId);
  const book = bookQuery.data ?? null;
  const change = useBookChanges(bookId);
  const deleteBook = useDeleteBook();
  const busy = change.find.isPending;
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ title: "", author: "" });
  const [notes, setNotes] = useState("");
  const res = useMemo(() => parse(book?.result ?? ""), [book?.result]);

  // fill the fields once the book has loaded, and tidy the address to /books/12-clean-code
  useEffect(() => {
    if (!book) return;
    setNotes(book.notes); setF({ title: book.title, author: book.author });
    if (slug !== bookSlug(book)) nav({ to: "/books/$slug", params: { slug: bookSlug(book) }, replace: true });
  }, [book?.id]);

  if (!Number.isInteger(bookId) || bookQuery.error)
    return <LoadProblem error={bookQuery.error ? errorOf(bookQuery.error) : notFound} what="book" back="/books" backLabel="Back to my books" onRetry={() => bookQuery.refetch()} />;
  if (!book) return <div className="empty">Loading…</div>;

  const patch = (body: Parameters<typeof change.update.mutate>[0], onDone?: (b: Book) => void) => change.update.mutate(body, { onSuccess: (b) => onDone?.(b) });
  const find = () => change.find.mutate(undefined, { onSuccess: () => toast("Search done.") });
  const saveEdit = () => {
    if (!f.title.trim()) return;
    patch({ title: f.title, author: f.author }, (b) => {
      setEditing(false);
      nav({ to: "/books/$slug", params: { slug: bookSlug(b) }, replace: true });
    });
  };
  const remove = () => {
    if (!confirm(`Remove "${book.title}" from your list?`)) return;
    deleteBook.mutate(book.id, { onSuccess: () => nav({ to: "/books" }) });
  };

  const links = res?.links || [];
  const grouped = ORDER.map((k): [string, BookLink[]] => [k, links.filter((l) => l.kind === k)]).filter(([, l]) => l.length);

  return (
    <>
      <p className="back"><Link to="/books">← All books</Link></p>

      <header className="card book-hero">
        <Cover title={book.title} size="big" />
        <div className="book-hero-text">
          {editing ? (
            <div className="book-edit">
              <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Title" aria-label="Title" />
              <input value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} placeholder="Author (optional)" aria-label="Author" />
              <div className="row"><button className="primary" onClick={saveEdit}>Save</button><button className="ghost" onClick={() => { setEditing(false); setF({ title: book.title, author: book.author }); }}>Cancel</button></div>
            </div>
          ) : (
            <>
              <h1>{book.title}</h1>
              {book.author && <p className="muted">{book.author}</p>}
            </>
          )}
          <div className="row">
            <select className={"book-status " + book.status} value={book.status} onChange={(e) => patch({ status: e.target.value })} aria-label="Reading status">
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="primary" disabled={busy} onClick={find}>{busy ? "Searching… (up to 30s)" : res ? "Search again" : "Find links and PDFs"}</button>
            <More label="More" className="inline">
              <button className="ghost" onClick={() => setEditing(!editing)}>Edit title or author</button>
              <button className="ghost danger" onClick={remove}>Remove book</button>
            </More>
          </div>
          {book.foundAt && <p className="muted tiny">Last searched {new Date(book.foundAt).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
        </div>
      </header>

      <div className="book-page">
        <div className="book-main">
          {res?.summary || res?.whyForYou ? (
            <section className="card">
              <h2>What the AI found</h2>
              {res.summary && <p className="pre">{res.summary}</p>}
              {res.whyForYou && <p className="pre"><b>For you:</b> {res.whyForYou}</p>}
              <p className="muted tiny">Written by an AI from its own knowledge, so it can be wrong.</p>
            </section>
          ) : !res && (
            <section className="card"><h2>Nothing found yet</h2><p className="muted">Press "Find links and PDFs" and I'll look for free copies, library loans, previews and stores, and write a short summary.</p></section>
          )}

          {res && (
            <section className="card">
              <h2>Where to read it</h2>
              {links.length === 0 && <p className="muted">No copy found in the sources I checked. Try the places below.</p>}
              {grouped.map(([kind, items]) => (
                <div key={kind} className="book-group">
                  <h3>{GROUP[kind]}</h3>
                  <ul className="book-links">
                    {items.map((l) => (
                      <li key={l.url}><a className={"blink " + l.kind} href={l.url} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">{ICON[l.kind]}</span> {l.label}</a>{l.matched && <span className="muted tiny"> matched: {l.matched}</span>}</li>
                    ))}
                  </ul>
                </div>
              ))}
              {(res.more?.length ?? 0) > 0 && (
                <div className="book-group">
                  <h3>More places to look</h3>
                  <ul className="book-links">{res.more.map((l) => <li key={l.url}><a className={"blink " + l.kind} href={l.url} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">{ICON[l.kind]}</span> {l.label}</a></li>)}</ul>
                </div>
              )}
              {(res.sourcesFailed?.length ?? 0) > 0 && <p className="muted tiny">Couldn't check: {res.sourcesFailed.join("; ")}. Press "Search again" in a minute.</p>}
              <p className="muted tiny">Only legal sources: free and public-domain copies, library loans, previews and stores.</p>
            </section>
          )}

          <section className="card">
            <h2>My notes</h2>
            <textarea className="book-notes" placeholder="Why I want to read it, what I learned…" value={notes} onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== book.notes && patch({ notes }, () => toast("Notes saved"))} aria-label="My notes" />
          </section>
        </div>

        <Ask book={book} />
      </div>
    </>
  );
}
