import { Link, useNavigate } from "@tanstack/react-router";

// Type-level tests of the typed routes (P3-04). Nothing imports this file; `pnpm typecheck` checks it, and each
// expected-error comment below must stay an error (an unused one fails the typecheck).
export function RouterChecks() {
  const nav = useNavigate();
  const ok = () => nav({ to: "/posts/$id", params: { id: "3" } });
  // @ts-expect-error a page that doesn't exist
  const typo = () => nav({ to: "/postz" });
  // @ts-expect-error a page that needs a parameter, without it
  const missing = () => nav({ to: "/jobs/$id" });
  return (
    <>
      <Link to="/books/$slug" params={{ slug: "12-clean-code" }} onClick={ok}>ok</Link>
      {/* @ts-expect-error a link to a page that doesn't exist */}
      <Link to="/setings" onClick={typo}>typo</Link>
      {/* @ts-expect-error the wrong parameter name */}
      <Link to="/emails/$id" params={{ slug: "1" }} onClick={missing}>wrong</Link>
    </>
  );
}
