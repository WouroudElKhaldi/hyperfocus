import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

// "How do I get this?" (P5-07c, at your request): step-by-step guides for the three connections, written for people
// who don't work in tech. Each part of Settings → Your connections links to its section here (#ai, #gmail, #linkedin).

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="guide-steps">{children}</ol>;
}

export default function ConnectionsHelp() {
  const hash = useRouterState({ select: (s) => s.location.hash });
  // open at the section you came for (after the page's own "back to the top" when it opens)
  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => document.getElementById(hash)?.scrollIntoView({ block: "start" }), 50);
    return () => clearTimeout(t);
  }, [hash]);

  return (
    <div className="guide">
      <h1>How to connect your accounts</h1>
      <p className="sub">
        Three short guides, one for each thing in <Link to="/backup">Settings → Your connections</Link>. No technical knowledge needed: follow the
        steps in order, copy one thing, paste it in Hyperfocus. Whatever you paste is locked (encrypted) and never shown again, not even to the
        website's owner.
      </p>
      <nav className="card" aria-label="Guides">
        <b>Jump to:</b> <a href="#ai">The AI (DeepSeek key)</a> · <a href="#gmail">Email (Gmail)</a> · <a href="#linkedin">LinkedIn posting</a>
      </nav>

      <section id="ai" className="card" aria-labelledby="ai-title">
        <h2 id="ai-title">1. The AI: your DeepSeek API key</h2>
        <p>
          The AI writes and polishes your posts, breaks tasks into steps, coaches you and answers in the chat. Hyperfocus may give you a few AI
          requests a day for free; with your own key you have no daily limit. <b>Time needed: about 5 minutes.</b> DeepSeek charges very little
          per use, but you add some credit first (a few dollars lasts a long time).
        </p>
        <Steps>
          <li>Open <a href="https://platform.deepseek.com" target="_blank" rel="noreferrer">platform.deepseek.com</a> and sign up (with your email, or Google).</li>
          <li>On the left, click <b>Top up</b> and add a small amount of credit (for example $2). Without credit the key won't work.</li>
          <li>On the left, click <b>API keys</b>, then <b>Create new API key</b>. Name it <i>Hyperfocus</i> and click <b>Create</b>.</li>
          <li>
            A long code starting with <code>sk-</code> appears. Click <b>Copy</b>. <b>It is only shown once</b>: if you close it before copying,
            just make a new one.
          </li>
          <li>In Hyperfocus, open <Link to="/backup">Settings</Link> → <b>Your connections</b> → <b>AI (DeepSeek)</b>, paste it, and click <b>Save</b>.</li>
        </Steps>
        <p className="muted">Done when it says <i>Connected: key ending in …</i>. To stop using it, click <b>Disconnect</b>; you can also delete the key on DeepSeek's site.</p>
      </section>

      <section id="gmail" className="card" aria-labelledby="gmail-title">
        <h2 id="gmail-title">2. Email: send from your own Gmail</h2>
        <p>
          So the emails you write in Hyperfocus (job applications, follow-ups) are sent from your own Gmail address, and appear in your Gmail's
          "Sent" folder. There are two ways; you only need one.
        </p>

        <h3>The easy way: Connect with Google (1 minute)</h3>
        <Steps>
          <li>In <Link to="/backup">Settings</Link> → <b>Your connections</b> → <b>Email (Gmail)</b>, click <b>Connect with Google</b>.</li>
          <li>Google opens. Choose your Gmail account.</li>
          <li>Google asks if Hyperfocus may <b>send email on your behalf</b>. Click <b>Continue</b> / <b>Allow</b>. (It can only send; it can never read your emails.)</li>
          <li>You come back to Settings, and it says <i>Gmail connected with Google</i>. That's it.</li>
        </Steps>
        <p className="muted">If the button says it isn't set up for this app, the website's owner hasn't switched it on yet: use the other way below.</p>

        <h3>The other way: an App Password (5 minutes)</h3>
        <p>An App Password is a special 16-letter password Google makes for one app. Your real Gmail password is never shared.</p>
        <Steps>
          <li>
            Open <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer">myaccount.google.com/security</a> (sign in if
            asked). Find <b>2-Step Verification</b>. If it says <b>Off</b>, click it and follow Google's steps to turn it <b>on</b> (Google needs it
            before it makes App Passwords).
          </li>
          <li>Open <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">myaccount.google.com/apppasswords</a>.</li>
          <li>Under <b>App name</b>, type <i>Hyperfocus</i> and click <b>Create</b>.</li>
          <li>Google shows a 16-letter code in a yellow box (like <code>abcd efgh ijkl mnop</code>). Copy it. It is only shown once.</li>
          <li>
            In Hyperfocus, <Link to="/backup">Settings</Link> → <b>Your connections</b> → <b>Email (Gmail)</b>: type your Gmail address, paste the
            code (the spaces don't matter), and click <b>Save</b>.
          </li>
        </Steps>
        <details>
          <summary>The App passwords page says "The setting you are looking for is not available for your account"</summary>
          <p>
            This happens when 2-Step Verification is off, or with some work or school accounts (their administrator blocks it). Turn on 2-Step
            Verification first; with a work account, use <b>Connect with Google</b> or a personal Gmail instead.
          </p>
        </details>
        <p className="muted">To stop: click <b>Disconnect</b> in Hyperfocus, and you can also remove the App Password on the same Google page.</p>
      </section>

      <section id="linkedin" className="card" aria-labelledby="linkedin-title">
        <h2 id="linkedin-title">3. LinkedIn posting (through n8n)</h2>
        <p>
          So Hyperfocus can publish your finished posts on your LinkedIn, right away or at the time you schedule. It goes through <b>n8n</b>, a
          service that connects apps together: Hyperfocus hands the post to n8n, and n8n posts it on LinkedIn as you. You set this up once.{" "}
          <b>Time needed: about 15 minutes.</b>
        </p>
        <p className="muted">
          Without it, you can still use everything: Hyperfocus gives you a <b>Copy</b> button and you paste the post on LinkedIn yourself.
        </p>

        <h3>The easy way: Connect LinkedIn (1 minute)</h3>
        <Steps>
          <li>In <Link to="/backup">Settings</Link> → <b>Your connections</b> → <b>LinkedIn posting</b>, click <b>Connect LinkedIn</b>.</li>
          <li>LinkedIn opens. Sign in if asked, and click <b>Allow</b> so Hyperfocus can post for you (it can't read your messages or change your profile).</li>
          <li>You come back to Settings, and it says <i>Connected to LinkedIn as</i> your name. Your posts now go straight to your LinkedIn.</li>
        </Steps>
        <p className="muted">
          LinkedIn asks you to allow it again about every 60 days; Hyperfocus tells you when. If the button says it isn't set up for this
          app, the website's owner hasn't switched it on yet: use n8n below instead.
        </p>

        <h3>Or: through your own n8n</h3>
        <p className="muted">For people who already use n8n, or when Connect LinkedIn isn't available.</p>
        <h3>Step A: get n8n</h3>
        <Steps>
          <li>
            Go to <a href="https://n8n.io" target="_blank" rel="noreferrer">n8n.io</a> and click <b>Get started</b> to make an account (n8n Cloud has a
            free trial; after that it is a monthly plan. People who are comfortable with servers can also run n8n themselves for free).
          </li>
          <li>Once inside, click <b>Create workflow</b> (or <b>+</b> → <b>Workflow</b>). Name it <i>Hyperfocus to LinkedIn</i>.</li>
        </Steps>

        <h3>Step B: the part that receives your posts (Webhook)</h3>
        <Steps>
          <li>Click <b>Add first step</b>, search for <b>Webhook</b>, and choose it.</li>
          <li>Set <b>HTTP Method</b> to <b>POST</b>. Leave everything else as it is.</li>
          <li>Close the Webhook box (top left arrow, or click outside it).</li>
        </Steps>

        <h3>Step C: the part that posts on LinkedIn</h3>
        <Steps>
          <li>Click the <b>+</b> on the right of the Webhook, search for <b>LinkedIn</b>, and choose <b>Create a post</b>.</li>
          <li>
            Next to <b>Credential to connect with</b>, choose <b>Create new credential</b>. On n8n Cloud, click <b>Connect my account</b>, sign in to
            LinkedIn and click <b>Allow</b>. (If n8n asks you for a Client ID and Client Secret instead, see "n8n asks for a Client ID" below.)
          </li>
          <li>Set <b>Post As</b> to <b>Person</b>, and in <b>Person</b> pick your name.</li>
          <li>
            Click in the <b>Text</b> box, switch it to <b>Expression</b> (the small toggle above it), and type exactly:{" "}
            <code>{"{{ $json.body.text }}"}</code> — this is where Hyperfocus's post goes.
          </li>
          <li>Close the LinkedIn box.</li>
        </Steps>

        <h3>Step D: switch it on and copy its address</h3>
        <Steps>
          <li>Click <b>Save</b>, then switch the workflow on (the <b>Inactive / Active</b> switch at the top, or <b>Publish</b>, depending on your n8n version).</li>
          <li>Open the <b>Webhook</b> box again. Click <b>Production URL</b> (not "Test URL") and copy the address. It looks like <code>https://yourname.app.n8n.cloud/webhook/…</code>.</li>
          <li>
            In Hyperfocus, <Link to="/backup">Settings</Link> → <b>Your connections</b> → <b>LinkedIn posting</b>: paste it and click{" "}
            <b>Save</b>.
          </li>
          <li>Try it: write a short post in Hyperfocus and click <b>Publish</b>. It should appear on your LinkedIn within a few seconds.</li>
        </Steps>

        <details>
          <summary>n8n asks for a Client ID and Client Secret (getting your LinkedIn "id")</summary>
          <p>This only happens if you run n8n yourself. You make a small "app" on LinkedIn once, and it gives you the two codes:</p>
          <Steps>
            <li>
              Open <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noreferrer">linkedin.com/developers/apps</a> and click{" "}
              <b>Create app</b>.
            </li>
            <li>
              App name: <i>My posting</i>. <b>LinkedIn Page</b>: LinkedIn requires a company page here. If you don't have one, make a simple page for
              yourself first (LinkedIn → <b>For Business</b> → <b>Create a Company Page</b>); it can stay empty. Add a logo (any picture), tick the
              agreement, click <b>Create app</b>.
            </li>
            <li>Open the <b>Products</b> tab and click <b>Request access</b> for <b>Share on LinkedIn</b> and for <b>Sign In with LinkedIn using OpenID Connect</b>.</li>
            <li>Open the <b>Auth</b> tab. You'll see the <b>Client ID</b> and the <b>Primary Client Secret</b> (click the eye to show it).</li>
            <li>
              In n8n's credential window, copy the <b>OAuth Redirect URL</b> it shows. Back on LinkedIn's Auth tab, under{" "}
              <b>Authorized redirect URLs for your app</b>, click the pencil, add that address, and click <b>Update</b>.
            </li>
            <li>Paste the Client ID and Client Secret into n8n, click <b>Connect my account</b>, sign in to LinkedIn and click <b>Allow</b>.</li>
          </Steps>
        </details>
        <details>
          <summary>Publishing says n8n answered with an error, or nothing appears on LinkedIn</summary>
          <ul>
            <li>Check the workflow is switched <b>on</b> (Active / Published), and that you copied the <b>Production</b> URL, not the Test URL.</li>
            <li>In n8n, open <b>Executions</b> (left side): each attempt is listed there with what went wrong.</li>
            <li>LinkedIn connections expire after a while: in n8n, open the LinkedIn credential and click <b>Reconnect</b>.</li>
          </ul>
        </details>
      </section>

      <p className="muted">
        Stuck anyway? Everything still works without these: drafts, tasks, notes and the rest. You can connect them any time later.
      </p>
    </div>
  );
}
