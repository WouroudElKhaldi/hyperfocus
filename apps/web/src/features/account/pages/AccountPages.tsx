import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND } from "../../../brand.ts";
import { authCall } from "../api.ts";

// Signing in, signing up, and a forgotten password (P5-04), shown instead of the app in cloud mode when nobody is signed in.
// Calm and short: one thing per screen, plain messages, nothing to lose (typed text stays when something goes wrong).
// The page is chosen by the address: /sign-up, /forgot-password, /reset-password?token=…, anything else signs in.

type Page = "sign-in" | "sign-up" | "forgot" | "reset";
const pageOf = (path: string): Page => (path === "/sign-up" ? "sign-up" : path === "/forgot-password" ? "forgot" : path === "/reset-password" ? "reset" : "sign-in");
const go = (path: string) => { window.history.pushState(null, "", path); window.dispatchEvent(new PopStateEvent("popstate")); };

function Frame({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--bg)] p-4" id="main">
      <div className="card w-full max-w-sm">
        <p className="m-0 mb-1 font-semibold text-[var(--accent-strong)]">{BRAND.name}</p>
        <h1 className="m-0 mb-1">{title}</h1>
        <p className="sub">{sub}</p>
        {children}
      </div>
    </main>
  );
}
function Field({ id, label, ...input }: { id: string; label: string } & React.ComponentProps<"input">) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...input} />
    </div>
  );
}
const Note = ({ kind, children }: { kind: "error" | "ok"; children: ReactNode }) => (
  <p role={kind === "error" ? "alert" : "status"} className={`m-0 text-sm ${kind === "error" ? "text-destructive" : "text-ok"}`}>{children}</p>
);
const Link = ({ to, children }: { to: string; children: ReactNode }) => (
  <a href={to} onClick={(e) => { e.preventDefault(); go(to); }}>{children}</a>
);

export default function AccountPages({ google, onSignedIn }: { google: boolean; onSignedIn: () => void }) {
  const [page, setPage] = useState<Page>(() => pageOf(window.location.pathname));
  useEffect(() => {
    const follow = () => setPage(pageOf(window.location.pathname));
    window.addEventListener("popstate", follow);
    return () => window.removeEventListener("popstate", follow);
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [unverified, setUnverified] = useState(false);
  const home = `${window.location.origin}/`;

  const run = (fn: () => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(""); setDone(""); setUnverified(false);
    try { await fn(); } catch (err) {
      const x = err as Error & { status?: number };
      if (x.status === 403) setUnverified(true);
      setError(x.status === 403 ? "Please confirm your email first: open the link we sent you." : x.message);
    } finally { setBusy(false); }
  };
  const withGoogle = async () => {
    setBusy(true);
    try { window.location.href = (await authCall<{ url: string }>("/sign-in/social", { provider: "google", callbackURL: home })).url; }
    catch (err) { setError((err as Error).message); setBusy(false); }
  };

  if (page === "sign-up")
    return (
      <Frame title="Make your account" sub="It takes a minute. We'll send a link to confirm your email.">
        {done ? <Note kind="ok">{done}</Note> : (
          <form className="grid gap-3" onSubmit={run(async () => {
            await authCall("/sign-up/email", { email, password, name, phone, callbackURL: home });
            setDone(`Check your inbox: we sent a link to ${email}. Open it to start.`);
          })}>
            <Field id="su-name" label="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            <Field id="su-email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            <Field id="su-phone" label="Phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="+961 70 123 456" required />
            <Field id="su-pass" label="Password (8 or more characters)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
            {error && <Note kind="error">{error}</Note>}
            <Button type="submit" disabled={busy}>{busy ? "Making it…" : "Make my account"}</Button>
          </form>
        )}
        <p className="m-0 mt-3 text-sm">Already have one? <Link to="/sign-in">Sign in</Link></p>
      </Frame>
    );

  if (page === "forgot")
    return (
      <Frame title="Forgot your password?" sub="No problem. We'll email you a link to choose a new one.">
        {done ? <Note kind="ok">{done}</Note> : (
          <form className="grid gap-3" onSubmit={run(async () => {
            await authCall("/request-password-reset", { email, redirectTo: `${window.location.origin}/reset-password` });
            setDone("If that address has an account, the link is on its way. Check your inbox.");
          })}>
            <Field id="fp-email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            {error && <Note kind="error">{error}</Note>}
            <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send me the link"}</Button>
          </form>
        )}
        <p className="m-0 mt-3 text-sm"><Link to="/sign-in">Back to sign in</Link></p>
      </Frame>
    );

  if (page === "reset") {
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    return (
      <Frame title="Choose a new password" sub="Then sign in with it.">
        {done ? <Note kind="ok">{done} <Link to="/sign-in">Sign in</Link></Note> : !token ? <Note kind="error">This link is incomplete. Ask for a new one.</Note> : (
          <form className="grid gap-3" onSubmit={run(async () => {
            await authCall("/reset-password", { newPassword: password, token });
            setDone("Your password is changed.");
          })}>
            <Field id="rp-pass" label="New password (8 or more characters)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
            {error && <Note kind="error">{error}</Note>}
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save my new password"}</Button>
          </form>
        )}
      </Frame>
    );
  }

  return (
    <Frame title="Welcome back" sub="Sign in to pick up where you left off.">
      <form className="grid gap-3" onSubmit={run(async () => {
        await authCall("/sign-in/email", { email, password });
        if (window.location.pathname !== "/") window.history.replaceState(null, "", "/");
        onSignedIn();
      })}>
        <Field id="si-email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <Field id="si-pass" label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        {error && <Note kind="error">{error}</Note>}
        {unverified && (
          <Button type="button" variant="outline" disabled={busy} onClick={async () => {
            await authCall("/send-verification-email", { email, callbackURL: home }).catch(() => {});
            setError(""); setDone(`We sent a new link to ${email}.`);
          }}>Send the link again</Button>
        )}
        {done && <Note kind="ok">{done}</Note>}
        <Button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
      {google && <Button type="button" variant="outline" className="mt-3 w-full" disabled={busy} onClick={withGoogle}>Sign in with Google</Button>}
      <p className="m-0 mt-3 text-sm"><Link to="/forgot-password">Forgot your password?</Link></p>
      <p className="m-0 mt-1 text-sm">New here? <Link to="/sign-up">Make an account</Link></p>
    </Frame>
  );
}
