# Feature parity map (P0-04)

Every feature Hyperfocus has today, and the automated tests that prove it still works.
The refactor may not remove anything: a phase is only done when every row here is still green.

**Automated:** ✅ covered · 🟡 partly covered (what's missing is named) · ❌ not covered yet (manual check until the named task adds it)
**By hand:** ☐ to be checked by a person before each phase ends (`docs/manual-checklist` grows from the ❌/🟡 rows)

Test locations: `apps/api/test/contract/*.test.js` (API), `apps/api/test/unit/logic.test.js` (rules),
`apps/api/test/contract/shapes.test.js` (response shapes), `e2e/pages.spec.js` (browser).
Run everything: `npm test` (API + browser) · `npm run test:api` · `npm run test:e2e` · `npm run test:routes --prefix server`.

## Plan
| Feature | Automated | Tests | By hand |
|---|---|---|---|
| Today view | ✅ | e2e "loads /" | ☐ |
| Focus round timer | ✅ | e2e "Today: start and pause the focus round" | ☐ |
| Brain dump → AI sort into items | 🟡 API only | ai.test "organises a brain dump"; the Today "sort" UI isn't clicked (P3-07) | ☐ |
| Tasks + steps + priorities + due days | ✅ | tasks.test (8), e2e "Tasks: add a task and tick it" | ☐ |
| AI "break it down" steps | ✅ | ai.test "breaks a task into steps" | ☐ |
| Calendar events (create/edit/skip/delete, categories, repeats) | ✅ | calendar.test (11), unit occurrenceDays (6), e2e "Calendar: add an event" | ☐ |
| Calendar month / week / day views | 🟡 | only the default view is loaded in e2e (P3-08) | ☐ |
| AI natural-language quick add | ✅ | calendar.test "parses a sentence…" | ☐ |
| Plan my study week | 🟡 | calendar.test "plans study blocks" (fake AI returns no blocks, so placing blocks isn't checked; P2-12) | ☐ |
| .ics export | ✅ | calendar.test "exports an .ics file" | ☐ |
| My reminders (one-off + daily/weekdays/weekly) | ✅ | reminders.test (4), background.test "fires due reminders…", unit nextOccurrence (4) | ☐ |
| My reminders widget (UI) | ❌ | P3-08 | ☐ |
| Automatic nudges: study break, post going live, event reminders, morning summary | ❌ | `checkReminders` runs in tests but isn't asserted (P2-21) | ☐ |

## Grow
| Feature | Automated | Tests | By hand |
|---|---|---|---|
| Goals + actions + logs | ✅ | goals.test (7), e2e "Goals: add a goal…" | ☐ |
| Goal AI analysis (verdict, refined goal, steps) | ✅ | goals.test "analyses a goal with the AI…" | ☐ |
| Skills map + bulk add + levels | ✅ | skills.test (6), e2e "Skills: add a skill" | ☐ |
| Skills AI suggest + AI plan | ✅ | skills.test "suggests skills and makes a plan…" | ☐ |
| Study log: live timer, pause/resume, stop, continue, past sessions, never-shorten rule | ✅ | study.test (8), e2e "Study: start and stop the timer" | ☐ |
| Books: add/edit/status/delete | ✅ | books.test, e2e "Books: add a book, open it…" | ☐ |
| Books: AI Q&A chat | ✅ | books.test "asks the AI about a book…", e2e | ☐ |
| Books: find free copies (Open Library, Google Books, Gutenberg) | 🟡 | only the 404 path; real search needs the internet (fake in P2-11) | ☐ |
| Weekly review (AI) | ✅ | wins-reviews.test, e2e "Review: write a weekly review" | ☐ |

## Share
| Feature | Automated | Tests | By hand |
|---|---|---|---|
| Notes / thoughts (kinds, pin, archive, "posted" link) | ✅ | notes.test (6), e2e "Notes: add a thought" | ☐ |
| LinkedIn posts: create/edit/delete | ✅ | posts.test, e2e "Posts: create a post and open the editor" | ☐ |
| AI rewrite / edit by instruction / polish | ✅ | ai.test (rewrite, instruction, polish) | ☐ |
| Post ideas from study notes | ✅ | ai.test "suggests post ideas…" | ☐ |
| Publish via n8n (+ failure handling) | ✅ | posts.test "publishes through n8n…", "…reports n8n failures as 502" | ☐ |
| Schedule / unschedule + validation (time, 3000 chars, @mentions) | ✅ | posts.test "schedules…", "validates scheduling" | ☐ |
| Scheduled auto-posting + missed posts | ✅ | background.test "auto-posts a scheduled post…" | ☐ |
| Scheduler retries (n8n down, max 3 attempts) | ❌ | P2-15 | ☐ |
| Copy + open LinkedIn fallback (no n8n) | ❌ | UI only (P3-11) | ☐ |
| Email: drafts, HTML cleaning, attachments, inline images, duplicate | ✅ | emails.test (9), unit "email HTML cleaning", e2e "Email: create a draft…" | ☐ |
| Email templates (save, rename, use, files) | ✅ | emails.test "email templates" | ☐ |
| Email AI polish (keeps formatting) | ✅ | emails.test "polishes an email…" | ☐ |
| Email: actually sending through Gmail | 🟡 | only "not set up" refusal; real send needs an SMTP fake (P2-16) | ☐ |
| Rich text editor (toolbar, paste) | ❌ | P3-12 | ☐ |
| Job applications: pipeline, follow-ups, applied date, linked emails | ✅ | jobs.test (6), e2e "Jobs: add a job and open it" | ☐ |
| Sending a linked email flips the job to "applied" | ❌ | needs the SMTP fake (P2-16) | ☐ |

## You
| Feature | Automated | Tests | By hand |
|---|---|---|---|
| Support chat: threads, rename, delete, temporary chat | ✅ | chat.test (7), e2e "Chat: send a message…" | ☐ |
| Crisis safeguard | ✅ | chat.test "flags crisis messages…", unit crisis check (9) | ☐ |
| "Need urgent help?" panel (UI) | ❌ | P3-14 | ☐ |
| I'm stuck helper | 🟡 API only | ai.test "helps when stuck…"; the UI isn't clicked (P3-07) | ☐ |
| Wins timeline (manual + tasks + posts + study) + AI talking points | ✅ | wins-reviews.test (4), e2e "Wins: add a win" | ☐ |
| Companion pet: create, edit, wardrobe rules, XP, stages, catalog | ✅ | pet.test (9), unit "pet XP rules", e2e "Pet: hatch a companion" | ☐ |
| Pet art for all stages / species / clothes | ❌ | screenshot comparison in P3-15 | ☐ |
| Music player (generated tracks, 8D, YouTube songs) | 🟡 | e2e "the music player opens…"; audio itself can't be asserted (P3-16) | ☐ |
| Quotes / gentle lines | ❌ | P3-14 | ☐ |
| Profile | ✅ | profile-settings-backups.test (2), e2e "Profile: save your name" | ☐ |
| Settings: reminders, break interval, morning time | ✅ | profile-settings-backups.test "reads defaults and saves clamped values…" | ☐ |
| Theme: light / dark / auto | ✅ | e2e "the theme can be switched…" | ☐ |
| Colour palettes | ❌ | P3-01 | ☐ |
| Backups: manual, list, download, path safety | ✅ | profile-settings-backups.test (2), e2e "Settings: make a backup" | ☐ |
| Automatic daily backup + keep newest 30 | ❌ | P4-08 | ☐ |
| Test notification | ✅ | profile-settings-backups.test (dry run) | ☐ |
| Demo mode (secrets removed, risky routes blocked) | ❌ | P2-20 | ☐ |

## Ops
| Feature | Automated | Tests | By hand |
|---|---|---|---|
| Security headers / CSP | ✅ | e2e "pages are served with the security headers" | ☐ |
| API response shapes stay the same | ✅ | shapes.test (29 snapshots) | – |
| Every API route has a test | ✅ | `npm run test:routes --prefix server` (125/125) | – |
| Phone layout | 🟡 | every page loads on a phone viewport ("@phone"); layout not compared (P3-17) | ☐ |
| Autostart / stop scripts, demo sharing scripts | ❌ | PowerShell; manual until local mode is redone (P5-13) | ☐ |
| Database viewer script | ❌ | manual | ☐ |

**Totals:** 39 ✅ · 8 🟡 · 14 ❌ (61 features). Every ❌/🟡 row names the task that closes it.
