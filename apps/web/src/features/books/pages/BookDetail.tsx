import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { errorOf } from "../../../api.ts";
import { useToast } from "../../../App.tsx";
import LoadProblem, { notFound } from "../../../components/LoadProblem.tsx";
import More from "../../../components/More.tsx";
import { useAskBook, useBook, useBookChanges, useBookChat, useClearBookChat, useDeleteBook } from "../api.ts";
import { Cover, ICON, STATUS, bookPath, bookSlug, parse } from "../components/bookParts.tsx";
import type { Book, BookLink } from "../../../types.ts";


// (in the chosen language: the question goes to the AI as written)
const QUESTIONS = () => [i18next.t("books.q1"), i18next.t("books.q2"), i18next.t("books.q3"), i18next.t("books.q4"), i18next.t("books.q5")];

const ORDER = ["free", "borrow", "preview", "buy", "info"];
const GROUP: Record<string, string> = { free: i18next.t("books.freeToReadOr"), borrow: i18next.t("books.borrowForFree"), preview: i18next.t("books.previews"), buy: i18next.t("books.buyIt"), info: i18next.t("books.learnMore") };

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
    <section className="card book-ask" aria-label={i18next.t("books.askTheAiAbout")}>
      <div className="book-ask-head">
        <h2>{i18next.t("books.askAboutThisBook")}</h2>
        {(msgs?.length ?? 0) > 0 && (confirm
          ? <span className="row"><button className="danger-btn tiny-btn" onClick={clear}>{i18next.t("books.clearIt")}</button><button className="ghost tiny-btn" onClick={() => setConfirm(false)}>{i18next.t("books.keep")}</button></span>
          : <button className="ghost tiny-btn" onClick={() => setConfirm(true)}>{i18next.t("books.clearChat")}</button>)}
      </div>
      <div className="chat-log book-chat-log" aria-live="polite">
        {msgs === null && <div className="empty">{i18next.t("books.loading")}</div>}
        {msgs?.length === 0 && (
          <div className="chat-empty">
            <p className="muted">{i18next.t("books.askAnythingAbout")} <b>{book.title}</b>{i18next.t("books.yourQuestionsAndThe")}</p>
            <div className="chip-row">{QUESTIONS().map((q) => <button key={q} className="trait" onClick={() => send(q)}>{q}</button>)}</div>
          </div>
        )}
        {msgs?.map((m) => <div key={m.id} className={"bubble-row " + m.role}><div className={"msg " + m.role}>{m.content}</div></div>)}
        {busy && <div className="bubble-row assistant"><div className="msg assistant typing" aria-label={i18next.t("books.thinking")}><i /><i /><i /></div></div>}
        <div ref={end} />
      </div>
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <textarea ref={box} rows={1} placeholder={i18next.t("books.askAboutThisBook2")} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} aria-label={i18next.t("books.yourQuestion")} />
        <button className="primary" disabled={!text.trim() || busy}>{i18next.t("books.ask")}</button>
      </form>
      <p className="muted tiny book-ask-note">{i18next.t("books.theAiAnswersFrom")}</p>
    </section>
  );
}

export default function BookDetail() {
  useTranslation(); // (re-renders this page when the language changes)
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
    return <LoadProblem error={bookQuery.error ? errorOf(bookQuery.error) : notFound} what="book" back="/books" backLabel={i18next.t("books.backToMyBooks")} onRetry={() => bookQuery.refetch()} />;
  if (!book) return <div className="empty">{i18next.t("books.loading")}</div>;

  const patch = (body: Parameters<typeof change.update.mutate>[0], onDone?: (b: Book) => void) => change.update.mutate(body, { onSuccess: (b) => onDone?.(b) });
  const find = () => change.find.mutate(undefined, { onSuccess: () => toast(i18next.t("books.searchDone")) });
  const saveEdit = () => {
    if (!f.title.trim()) return;
    patch({ title: f.title, author: f.author }, (b) => {
      setEditing(false);
      nav({ to: "/books/$slug", params: { slug: bookSlug(b) }, replace: true });
    });
  };
  const remove = () => {
    if (!confirm(i18next.t("books.removeAsk", { title: book.title }))) return;
    deleteBook.mutate(book.id, { onSuccess: () => nav({ to: "/books" }) });
  };

  const links = res?.links || [];
  const grouped = ORDER.map((k): [string, BookLink[]] => [k, links.filter((l) => l.kind === k)]).filter(([, l]) => l.length);

  return (
    <>
      <p className="back"><Link to="/books">{i18next.t("books.allBooks")}</Link></p>

      <header className="card book-hero">
        <Cover title={book.title} size="big" />
        <div className="book-hero-text">
          {editing ? (
            <div className="book-edit">
              <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={i18next.t("books.title")} aria-label={i18next.t("books.title")} />
              <input value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} placeholder={i18next.t("books.authorOptional")} aria-label={i18next.t("books.author")} />
              <div className="row"><button className="primary" onClick={saveEdit}>{i18next.t("books.save")}</button><button className="ghost" onClick={() => { setEditing(false); setF({ title: book.title, author: book.author }); }}>{i18next.t("books.cancel")}</button></div>
            </div>
          ) : (
            <>
              <h1>{book.title}</h1>
              {book.author && <p className="muted">{book.author}</p>}
            </>
          )}
          <div className="row">
            <select className={"book-status " + book.status} value={book.status} onChange={(e) => patch({ status: e.target.value })} aria-label={i18next.t("books.readingStatus")}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="primary" disabled={busy} onClick={find}>{busy ? i18next.t("books.searchingUpTo30s") : res ? i18next.t("books.searchAgain") : i18next.t("books.findLinksAndPdfs")}</button>
            <More label={i18next.t("books.more")} className="inline">
              <button className="ghost" onClick={() => setEditing(!editing)}>{i18next.t("books.editTitleOrAuthor")}</button>
              <button className="ghost danger" onClick={remove}>{i18next.t("books.removeBook")}</button>
            </More>
          </div>
          {book.foundAt && <p className="muted tiny">Last searched {new Date(book.foundAt).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
        </div>
      </header>

      <div className="book-page">
        <div className="book-main">
          {res?.summary || res?.whyForYou ? (
            <section className="card">
              <h2>{i18next.t("books.whatTheAiFound")}</h2>
              {res.summary && <p className="pre">{res.summary}</p>}
              {res.whyForYou && <p className="pre"><b>{i18next.t("books.forYou")}</b> {res.whyForYou}</p>}
              <p className="muted tiny">{i18next.t("books.writtenByAnAi")}</p>
            </section>
          ) : !res && (
            <section className="card"><h2>{i18next.t("books.nothingFoundYet")}</h2><p className="muted">{i18next.t("books.pressFindLinksAnd")}</p></section>
          )}

          {res && (
            <section className="card">
              <h2>{i18next.t("books.whereToReadIt")}</h2>
              {links.length === 0 && <p className="muted">{i18next.t("books.noCopyFoundIn")}</p>}
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
                  <h3>{i18next.t("books.morePlacesToLook")}</h3>
                  <ul className="book-links">{res.more.map((l) => <li key={l.url}><a className={"blink " + l.kind} href={l.url} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">{ICON[l.kind]}</span> {l.label}</a></li>)}</ul>
                </div>
              )}
              {(res.sourcesFailed?.length ?? 0) > 0 && <p className="muted tiny">Couldn't check: {res.sourcesFailed.join("; ")}. Press "Search again" in a minute.</p>}
              <p className="muted tiny">{i18next.t("books.onlyLegalSourcesFree")}</p>
            </section>
          )}

          <section className="card">
            <h2>{i18next.t("books.myNotes")}</h2>
            <textarea className="book-notes" placeholder={i18next.t("books.whyIWantTo")} value={notes} onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== book.notes && patch({ notes }, () => toast(i18next.t("books.notesSaved")))} aria-label={i18next.t("books.myNotes")} />
          </section>
        </div>

        <Ask book={book} />
      </div>
    </>
  );
}
