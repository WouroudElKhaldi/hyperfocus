import { Link } from "@tanstack/react-router";

// The privacy policy (P5-12), in plain words. Reachable signed out too (/privacy), from the sign-up page and Settings.
// It describes what this app really does; the website's owner should still have it checked for their country's law.

export default function Privacy({ signedOut = false }: { signedOut?: boolean }) {
  return (
    <div className="guide privacy">
      <h1>Privacy</h1>
      <p className="sub">What Hyperfocus keeps about you, why, who can see it, and how to take it with you or delete it. Last updated: 3 October 2026.</p>

      <section className="card" aria-labelledby="pv-what">
        <h2 id="pv-what">What we keep</h2>
        <ul>
          <li><b>Your account:</b> your full name, email address and phone number (asked at sign-up), and your password, stored only as a one-way hash (nobody can read it back). If you sign in with Google: your name, email and Google account id.</li>
          <li><b>What you put in the app:</b> tasks, notes, goals, reminders, calendar events, study sessions, posts, emails you write and their attachments, books, chats with the AI, your pet, your profile and settings.</li>
          <li><b>Your connections</b> (only if you add them): your DeepSeek key, your n8n webhook address, your Gmail App Password or Google permission to send email. These are <b>encrypted</b> before they are stored and are never shown again, not even to the website's owner.</li>
          <li><b>Technical:</b> your sign-in sessions (with the browser's name and address, to keep you signed in safely), and short server logs of requests (kept for troubleshooting, without what you wrote).</li>
        </ul>
      </section>

      <section className="card" aria-labelledby="pv-why">
        <h2 id="pv-why">Why</h2>
        <p>Only to run the app for you: show your things, send the reminders and emails you ask for, publish the posts you choose. <b>No advertising, no selling, no tracking across other sites, no analytics</b> companies.</p>
      </section>

      <section className="card" aria-labelledby="pv-who">
        <h2 id="pv-who">Who sees it</h2>
        <ul>
          <li><b>Other people using Hyperfocus never see your data.</b> Every request is checked so it can only reach your own things.</li>
          <li>The website's <b>admins</b> see the list of accounts (name, email, when it was made) to run the site, not what you wrote.</li>
          <li><b>Services that do work you ask for</b> receive only what that work needs:
            <ul>
              <li>DeepSeek (the AI): the text you send to the AI, when you use an AI feature.</li>
              <li>Google (Gmail): the emails you send, when you send them; and your sign-in, if you use "Sign in with Google".</li>
              <li>Your n8n and LinkedIn: the posts you publish.</li>
              <li>Your browser's push service (Google, Mozilla, Apple or Microsoft): the notifications you switched on for a device, encrypted so that service can't read them.</li>
            </ul>
          </li>
        </ul>
      </section>

      <section className="card" aria-labelledby="pv-keep">
        <h2 id="pv-keep">How long</h2>
        <p>As long as you have your account, unless you choose otherwise: in <b>Settings → Your data and privacy</b> you can have your AI chats deleted automatically after 30, 90 or 365 days. When you delete your account, everything goes at once; backups made by the site are replaced over the following 30 days.</p>
      </section>

      <section className="card" aria-labelledby="pv-rights">
        <h2 id="pv-rights">Your choices</h2>
        <ul>
          <li><b>Take it with you:</b> Settings → <b>Export my data</b> gives you everything you put in, as one file, any time.</li>
          <li><b>Correct it:</b> change anything in the app; your name and details in your Profile.</li>
          <li><b>Delete it:</b> Settings → <b>Delete my account</b> removes your account and everything in it, immediately and for good.</li>
          <li><b>Stop emails and notifications:</b> Settings → Where notifications go.</li>
          <li><b>Questions or requests:</b> write to the website's owner at the address they publish with the site.</li>
        </ul>
      </section>

      <section className="card" aria-labelledby="pv-safe">
        <h2 id="pv-safe">Keeping it safe</h2>
        <p>Connections are encrypted (HTTPS); passwords are hashed; your keys and tokens are encrypted with a key kept outside the database; each person's data is separated in every request and in the database itself.</p>
      </section>

      <p className="muted">{signedOut ? <Link to="/">Back</Link> : <Link to="/backup">Back to Settings</Link>}</p>
    </div>
  );
}
