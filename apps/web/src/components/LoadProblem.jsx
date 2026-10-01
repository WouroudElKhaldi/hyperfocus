import { Link } from "react-router-dom";

// What a detail page shows when its item can't be loaded, instead of "Loading…" forever:
// a deleted item or a bad link is "not found"; anything else (server down, busy) shows why and offers a retry.
export const notFound = Object.assign(new Error("Not found"), { status: 404 });
export const isId = (v) => /^\d+$/.test(String(v ?? ""));

export default function LoadProblem({ error, what, back, backLabel, onRetry }) {
  if (error.status === 404) {
    return (
      <>
        <h1>{what[0].toUpperCase() + what.slice(1)} not found</h1>
        <p className="sub">It may have been removed.</p>
        <Link className="btn primary" to={back}>{backLabel}</Link>
      </>
    );
  }
  return (
    <>
      <h1>Couldn't load this {what}</h1>
      <p className="sub">{error.message}</p>
      <div className="row">
        <button className="primary" onClick={onRetry}>Try again</button>
        <Link className="btn" to={back}>{backLabel}</Link>
      </div>
    </>
  );
}
