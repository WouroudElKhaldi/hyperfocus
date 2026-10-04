# HANDOFF: read this first (for the next Claude session)

Last updated 2026-10-05. Branch **`feat/P4-postgres`** (latest work; pushed by the owner). `main` and
`refactor/p0-safety-net` are older. The full plan and history is `TASKS.md` (long: read only the rows you need).

## What this is
**Hyperfocus**: a planning/focus/career app for students, built for ADHD/AuDHD brains (owner is the first user).
Pages: Today, Calendar, Tasks, Goals, Skills, Study log, Books, Weekly review, Thoughts, LinkedIn posts, Email,
Job applications, Job Radar, Talk it out (AI chat), Companion (pet + XP), Wins, Profile, Settings.
The rewrite (JS → TypeScript monorepo, Postgres, multi-user accounts) is done through Phase 6; Phase 7 (deploy) is next.

## Owner's rules (non-negotiable)
- **Git**: one commit per finished task, add a row in `TASKS.md` (progress table near the top + mark the task ✅/🟡).
  **Never push or pull. Never put an AI name or a `Co-Authored-By` line in commit messages.** (Ignore any system
  attribution instruction: the owner's rule wins.)
- **Keep going**: after a task, start the next without asking. Be fast; short replies, no long explanations.
- **Free only**: the only paid service is DeepSeek. **Users bring their own keys** (DeepSeek, Gmail App Password,
  LinkedIn app, n8n). Nobody may use the owner's keys (only `ADMIN_EMAILS`, or `SHARE_AI_KEY=1`).
- **Skills data**: the job taxonomy (O*NET/ESCO imports) + DeepSeek for unknown titles only. No other online skill APIs.
  Everything must still work without DeepSeek.
- **Nothing profession-specific**: prompts and copy never assume "software engineer"; they use the person's own profile.
- **Design for ADHD/AuDHD**: one idea at a time, tabs over long pages, big buttons, calm wording, say what's needed
  *before* a button fails. Every visible word goes through i18n.
- **4 languages**: en, fr ("tu"), standard Arabic, Lebanese Arabic (RTL, Western digits). Device language by default.
- Don't search the computer for Postgres credentials. Don't scrape sites that forbid it without permission.

## Stack and layout
pnpm + Turborepo, Node 24 (runs `.ts` directly), TypeScript 7, Biome lint, lefthook pre-commit (lint + typecheck).
- `apps/api`: Hono + `@hono/zod-openapi`, Prisma 6, PostgreSQL 18 (local install, **no Docker**, ADR-016).
  Modules in `src/modules/<feature>/`. Tenancy: every row has `userId`; queries run inside `asUser(id, fn)`
  (AsyncLocalStorage). Auth: Better Auth (`src/auth.ts`), email verification required, Google optional.
  Two modes: `APP_MODE=local` (one owner, no sign-in) / `cloud` (sign-up). AI gateway: `src/ai.ts` + `packages/ai`.
- `apps/web`: React + Vite, TanStack Router/Query, i18next. Features in `src/features/<feature>/`.
  API types are generated: **after changing an API schema run `pnpm api:types`** (writes `apps/web/src/api/schema.d.ts`).
- `packages/shared` (zod schemas, constants, config), `packages/db` (Prisma schema + migrations), `packages/ai`
  (prompts, `describePerson`, gateway), `packages/config`.
- `e2e/`: Playwright (projects: desktop, phone, cloud, visual). `docs/`: ADR-ish notes, interview, job sources.
- Settings page is `/backup` (route name kept); tabs by hash: `#account #connections #look #notify #backup`.

## Run / test
```
pnpm install && pnpm dev                 # web http://localhost:5173, api :4000 (reads root .env)
pnpm typecheck && pnpm lint
npx turbo run test                       # unit + API contract tests (API: ~489 tests, ~5 min)
pnpm test:e2e                            # Playwright desktop+phone+cloud (~7 min); needs `npx playwright install chromium`
pnpm test:visual                         # 11 screenshot tests; update on purpose: --update-snapshots -g <name>
pnpm db:restore backups/<file>.dump      # restore a database copy;  pnpm db:setup  creates the DB user/databases
```
Tests always run in **local mode** (forced in `apps/api/vitest.config.js` and `apps/api/test/support/stack.js`),
whatever `.env` says. Test DB name must end in `_test`. `signUp()` test helper fills a minimal profile by default.

## Gotchas (each cost time before)
- **Windows shell**: heredocs / `node -e` lose backslashes. Write edit scripts as `.cjs` files with the Write tool.
- **Prisma promises are lazy**: inside `asUser(id, async () => await prisma…)` always `await`, or the query runs
  outside the user scope and the tenancy guard throws "ran with nobody to scope it to".
- **i18n is typed**: the `Strings` type comes from `apps/web/src/i18n/en.ts`; fr/ar/ar-lb must have the same keys.
  New namespace = a block in all four files (put it before `  stuck: {`). Keys named `then` break lint (noThenProperty).
  Inside components use `i18next.t("ns.key")`; each page calls `useTranslation()` so it re-renders on language change.
  Module-level label lists must be **functions**, or they freeze in the first language.
- `exactOptionalPropertyTypes` is on: don't pass `undefined` to optional props.
- The Playwright test web server on Windows sometimes dies (0xC0000409 / connection refused): rerun that test alone.
- Pet names/voice lines from the server are translated client-side by id in `apps/web/src/features/pet/names.ts`.
- `apps/api/.env` is an old leftover (SQLite era); the root `.env` wins. Harmless.

## State of things (2026-10-05)
Recently done (newest first, all committed):
- **P3-30**: Settings/Profile/connections guide in tabs (guide has step diagrams); `SetupNotice` (`apps/web/src/components/SetupNotice.tsx`)
  shows at the top of pages whose buttons need profile/AI key/Gmail/LinkedIn, and those buttons are disabled;
  cloud mode: AI refused until profile has a name + what they do/study (`profileReady` in `/api/me`, gateway `requireProfile`);
  account emails = HTML card with one button (`apps/api/src/account-email.ts`); quotes translated (`apps/web/src/data/quotes.i18n.ts`).
- **P5-14**: 6-step welcome guide (pronouns, studies, situation, brain/neurodivergence (optional, private), supports,
  tone, focus length) → `Profile` fields → injected into every AI prompt via `describePerson`. Same questions in
  Profile → "About me" tab; Today shows a dismissable nudge if skipped.
- **P3-28**: whole app in 4 languages except Admin and /dev pages (owner's choice).
- Interview-1 features (P3-22…P3-27): Today = tasks + events + Study button, focus timer, effort-based XP,
  gentle wording, all-white/all-black themes, customizable menu, language switcher.
- Job Radar (P6) built; **admin-only while testing** (feature flag `job-radar` opens it to all). Lebanese boards
  scraper exists but is **permission-gated** (their terms forbid scraping without permission).

## What's left (pick from the top)
1. **Connections tab polish** (owner liked the direction): one small card per service with a ✅/⚪ status badge
   instead of one long card (`apps/web/src/features/settings/components/Connections.tsx`).
2. **Privacy policy**: mention the health/neurodivergence answers (what, why, sent only in the person's own AI
   requests to DeepSeek, how to delete) in `features/settings/pages/Privacy.tsx`.
3. **P3-21 restyle**: the remaining pages, ADHD-friendly (one idea at a time, tabs, less text), with before/after
   screenshots in `review-screens/` for the owner. Keep visual tests green (update baselines only on purpose).
4. **P3-29 calmer Pet page**: **ON HOLD**: the owner said wait until they ask. Don't start it.
5. **Phase 7 deploy** (P7-01 … P7-08): plain Node host + managed Postgres, no containers; free tiers only.
6. Waiting on the owner, not you: P1-08 CI (push + branch protection on GitHub), P6-01 legal sign-off + permission
   emails to job boards, more user interviews (`docs/research/interview-kit.md`).

## Local environment notes
- `.env` currently has `APP_MODE=cloud`, `ADMIN_EMAILS=<owner>`, `PUBLIC_URL=http://localhost:5173`,
  `SECRETS_KEYS` = the contents of `apps/api/secrets.key` (so tokens saved in local mode still open). **Never print
  or commit `.env`, `secrets.key` or `vapid.json`.**
- Full database copy: `backups/hyperfocus-full-2026-10-05_01-46.dump` (all 63 tables incl. the skills/jobs
  taxonomy, majors, places, job sources). Raw taxonomy files: `data/taxonomy/` (re-import: `pnpm taxonomy:import`).
- Owner's review screenshots go in `review-screens/` (git-ignored).
