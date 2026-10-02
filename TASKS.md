# Hyperfocus: Engineering Plan & Task Breakdown

> Owner: Lead Engineer · Status: **Draft v1 (2026-10-02)** · Applies to: whole repository
>
> Goal: turn Hyperfocus from a local, single-user JavaScript app into a **TypeScript, multi-user, deployable product**
> for students of every major, **designed first for students with ADHD**, without removing a single existing feature.
> Then add **Job Radar**: an n8n-driven job feed with per-user filters backed by a preset job/skill taxonomy.

---

## Progress

Legend: ✅ done · 🔄 in progress · ⏳ waiting on you · (no mark) not started. Branch: `refactor/p0-safety-net` (P0 = e5fd23f, P1-01 = aecfacd, P1-02 = 63579e7, P1-03 = 0da1591, P1-04 = 5f3aff5, P1-05 = f39825e, P1-06 = 66f81de, P1-07 = 1b9fa0d, P1-08 = f8b5869, P1-09 = 465bbde).

| Date | Task | What was done | Proof |
|---|---|---|---|
| 2026-10-02 | ✅ P0-01 | API contract suite (Vitest) in `server/test/contract/`. The real API runs against a throwaway DB, settings file and backup folder. DeepSeek and n8n are replaced by local fakes and Gmail is disabled, so tests never spend credits, post, email, or touch your data. Added a `BACKUP_DIR` override to `backup.js` (test seam). Route checker: `npm run test:routes`. Unit tests for reminder/calendar/XP/crisis/email-cleaning rules. Background-job tests (reminders firing, scheduled auto-post, missed post). | 170 tests green · 125/125 routes covered · 5 planted bugs: all caught after adding 1 missing test |
| 2026-10-02 | ✅ P0-02 | Shape snapshots of all 29 read endpoints (`shapes.test.js` + `__snapshots__`) | Stable across runs; a renamed field fails the test |
| 2026-10-02 | ✅ P0-03 | Playwright suite in `e2e/` (`npm run test:e2e`): all 21 pages load with zero console errors (desktop + phone), 17 main-action flows. Uses your installed Chrome. | 51/51 green; a planted console error fails the test |
| 2026-10-02 | ✅ P0-04 | [docs/feature-parity.md](docs/feature-parity.md): 61 features mapped to their tests. Added browser tests for security headers, music player and theme switching while mapping. Every gap names the task that closes it. | 39 ✅ · 8 🟡 · 14 ❌ · browser suite 54/54 |
| 2026-10-02 | ✅ P0-05 | Email, post and job pages no longer hang on "Loading…". A shared `components/LoadProblem.jsx` shows **"… not found"** with a way back for deleted items or bad links (e.g. `/emails/new`), and **"Couldn't load this …" + Try again** for server errors. `api.js` errors now carry `status`. Test written first and failed before the fix. | 5 new browser tests · browser suite 59/59 · checked by eye in the browser |
| 2026-10-02 | ✅ P0-06 | Server audit fixed. `npm audit fix` can't fix the high `deepmerge-ts` issue (every Prisma 6 release pins v7), so `server/package.json` has `overrides: { "deepmerge-ts": "^8.0.0" }`. Checked with `prisma validate`, `generate` and `db push`. Vitest moved to v5 (fixes a moderate advisory in the test runner). **Remove the override when Prisma is upgraded (P4-02).** | `npm audit` (server): 0 vulnerabilities · 170/170 API tests · 59/59 browser tests |
| 2026-10-02 | ⏳ P0-07 | Ready-to-use kit in [docs/research/interview-kit.md](docs/research/interview-kit.md): screener (never asks for a diagnosis), consent script, 30-min guide, notes template, affinity-map steps. **Needs you to run 8–12 interviews.** | – |
| 2026-10-02 | ⏳ P0-08 | **Proto**-personas (4 majors: Nursing, Business, CS, Fine Arts) + 2 journey maps + 6 assumptions to check, in [docs/research/personas.md](docs/research/personas.md). Clearly marked as unvalidated; rewrite after P0-07. | – |
| 2026-10-02 | ✅ P0-09 | [docs/metrics.md](docs/metrics.md): north star (weekly students making progress), funnel, feature + Job Radar metrics, guardrails. Privacy-first: event counts only, never content. | – |
| 2026-10-02 | ✅ P0-10 | Frozen backup at `%USERPROFILE%\hyperfocus-backups\pre-refactor-2026-10-02.db` (outside the repo). New `scripts/db-fingerprint.mjs` proves two DBs hold identical data. Restore steps + Postgres rehearsal plan in [docs/migration.md](docs/migration.md). | integrity_check ok · fingerprint of backup = dev.db |

| 2026-10-02 | ✅ P1-01 | `server/` → `apps/api/`, `client/` → `apps/web/` (git renames, so history is kept; `.env` and `dev.db` moved with them). npm → **pnpm 12.8.1** workspace (pinned with `packageManager`) and **Turborepo** (`turbo.json`, replaces `concurrently`). Every path updated: API code (root `.env`, backups, security headers, demo build), PowerShell scripts, tests, configs, README. New commands: `pnpm bootstrap` (not `pnpm setup`, which is a built-in pnpm command), `pnpm dev`, `pnpm test`. pnpm-specific fixes: `postinstall: prisma generate` (pnpm skipped generation, so the API couldn't start), build-script approvals and the `deepmerge-ts` override moved to `pnpm-workspace.yaml`. Test stack now shuts its fakes down if the API fails to start (it used to hang). | 170/170 API · 59/59 browser · 125/125 routes · `pnpm dev` checked in the browser against your real DB · autostart commands checked · data fingerprint unchanged |

| 2026-10-02 | ✅ P1-02 | `packages/config`: strict shared tsconfigs for **TypeScript 7** (base, `node` for the API, `react` for the web). Includes `erasableSyntaxOnly`, so Node 24 can later run `.ts` directly with no build step (P1-05). Apps have `tsconfig.json` + `@types/*`. **Biome 2.5** in `biome.jsonc` (2-space, 120 cols). Every relaxed rule has a comment naming the task that tightens it. Commands: `pnpm lint` (apps + root files via Turbo), `pnpm typecheck`, `pnpm format`, `pnpm check` (lint + typecheck + tests). Fixed what lint found: `isNaN` on Dates done properly (Biome's own suggested fix would have silently broken date validation), 2 handlers misnamed as hooks (`useTemplate`, `useIdea`) renamed, unused imports/vars/params and a dead `vNeck` drawing removed, safe `innerHTML` documented. | Lint 0 errors (540 deferred warnings) · typecheck passes · 170/170 API · 59/59 browser (×4 runs) |

| 2026-10-02 | ✅ P1-03 | New `packages/db` (`@hyperfocus/db`): Prisma schema moved there (git rename), client generated on install, re-exported as the one place apps get the DB from. The API depends on it instead of Prisma directly. Your database moved with the schema to `packages/db/prisma/dev.db` (SQLite paths resolve next to the schema; Postgres in P4 makes this moot). Updated: test harness, demo and database-viewer scripts, fingerprint script, `pnpm bootstrap`, README, docs. `packages/db/.env(.example)` for the Prisma CLI. | Data fingerprint identical before/after the move · running API reads your real data from the new path · 170/170 API · 59/59 browser · 125/125 routes · `pnpm bootstrap` and `open-database.ps1` checked |

| 2026-10-02 | ✅ P1-04 | New `packages/shared` (`@hyperfocus/shared`), the repo's first **TypeScript** package. It's run by plain `node` (Node 24 strips the types), with no build step. **Zod 4** schemas for Note, Task, Step and their create/update inputs. They describe today's API exactly, same error messages and quirks included (an unknown priority quietly becomes "normal"). `./constants` entry without Zod: note kinds and task priorities + **pet points**. Both apps now use these instead of their own copies: the website's points table was a hand-copied duplicate of the API's. | 11 schema tests · contract tests validate real API responses against the schemas (a planted schema bug fails them) · 172/172 API · 59/59 browser · Zod confirmed absent from the website bundle (+0.26 kB) |

| 2026-10-02 | ✅ P1-05 | Every API file is now **TypeScript** (`apps/api/src/*.ts`, git renames so history is kept), checked in strict mode: **0 errors** (it was 950). Node 24 runs the `.ts` files directly, so there is no build step and no `tsx`/`tsup` (decided in P1-02): `pnpm dev`, the autostart and demo scripts and the test harness all run `node src/index.ts`. Shared API types in `src/types.ts` (`Db`, `Wrap`, `httpError`, `errorInfo`, `activeMs`). `@hyperfocus/db` exports the model types. Real types for the pet data (items, unlock rules, personalities, quests), calendar occurrences, book links and AI messages. The few loose spots are named `UncheckedJson` with a `// TODO(types)` naming the P2 task that adds a Zod schema (request bodies, AI replies, book-site replies). Behaviour unchanged. Small cleanups the types forced: the email/template copy is split into `cloneEmail`/`cloneTemplate`; impossible nulls are handled where the old code would have crashed (a study-session edit for a missing id still answers 500, as recorded for P2). Fixed a flaky test: two `ago()` calls could land a millisecond apart. | `tsc` 0 errors · lint 0 errors · 172/172 API · 125/125 routes · every page's API endpoint answers 200 against the test API · browser suite **not re-run yet** (see ⏳ below) |

| 2026-10-02 | ✅ P1-06 | Every website file is now **TypeScript/TSX** (55 files, git renames), strict mode: **0 errors** (it was 1,847). `api.ts` is typed: each call names what it gets back (`api.get<Task[]>("/tasks")`), errors carry `status`/`code`, and `errorOf()` reads anything thrown. `src/types.ts` describes every API response as the website receives it (dates as strings), mirroring `apps/api/src`; `TODO(types)` notes it is replaced by the typed Hono client in P3-03. Components have prop types (calendar, pet art/clothes/items, wardrobe, rich editor with a typed ref, music player). The music engine has typed track definitions (`MusicDef` / `NoiseDef` / `BeatsDef`), so a typo in a track's scale or settings is now a compile error. Page imports in `App.tsx` are explicit lazy imports (each page still loads only when opened). Behaviour unchanged; impossible nulls are guarded instead of crashing. README and docs paths updated. | `tsc` 0 errors · lint 0 errors · `vite build` passes, one chunk per page as before · browser suite **not run yet** (see ⏳ below) |

| 2026-10-02 | ✅ P1-07 | Packages renamed: root `hyperfocus`, `@hyperfocus/api` (was `thought-studio-server`), `@hyperfocus/web` (was `thought-studio-client`). All five workspace packages now share the `@hyperfocus/` scope, so Turbo output reads `@hyperfocus/web:lint` and `pnpm --filter @hyperfocus/web …` works. **Kept on purpose:** the stored names that use `thought-studio` (backup file names `thought-studio-<date>.db`, calendar event IDs `…@thought-studio` in the .ics export, the n8n webhook path `thought-studio-post`). Renaming those would orphan your existing backups, duplicate events in calendars that imported the .ics, and break the n8n workflow. | `pnpm install --frozen-lockfile` unchanged lockfile · typecheck 4/4 · lint 5/5 |

| 2026-10-02 | ⏳ P1-08 | [`.github/workflows/ci.yml`](.github/workflows/ci.yml): on every push to `main` and every pull request it installs (pnpm from `packageManager`, Node 24, pnpm store cached), restores the Turborepo cache (`.turbo/cache`, as in Turborepo's own GitHub Actions guide), then runs typecheck → lint → API tests (unit + contract) → the route check → browser tests on Playwright's Chromium. A failed run keeps the browser report for 14 days. Needs no secrets: the tests use fakes. Newer pushes cancel older runs of the same branch. **Needs you:** it runs for the first time when you push, and making it a required check is a GitHub setting (Settings → Branches → protect `main` → require the "Typecheck, lint and tests" check). | Written, not run yet (no push from here) |

| 2026-10-02 | ✅ P1-09 | Pre-commit hook with **lefthook 2.1** ([`lefthook.yml`](lefthook.yml)), installed automatically by `pnpm install` (its install script is approved in `pnpm-workspace.yaml`). Before each commit: Biome lints the staged files, and Turborepo typechecks only the packages with staged changes. A change in `packages/shared` or `packages/db` also checks the apps that use them. Jobs run in parallel, and Turbo's cache makes unchanged packages instant. `git commit --no-verify` skips it once. README updated. | Planted type error in a staged website file: hook failed (exit 1), only the website typecheck ran, the other packages were skipped · this commit went through the hook |

| 2026-10-02 | ✅ P1-10 | **One settings file, checked at start-up.** `@hyperfocus/shared/config` has the Zod schema (`parseApiConfig`); `apps/api/src/config.ts` loads the project-root `.env` and checks it, and every API module reads `config` instead of `process.env` (`config.ts` is now the only reader). A wrong value stops the app with one line per problem, e.g. *"PORT must be a whole number between 1 and 65535"* or *"DATABASE_URL is missing. For the local SQLite database use …"*. Same defaults and the same demo rule as before (any non-empty `DEMO_MODE` is on, and every secret is blanked). Blank values count as unset, which the test harness relies on. `apps/api/.env.example` moved to the root `.env.example`, with comments. Your old `apps/api/.env` (identical to the root one) is still read, with a one-line note at start-up; delete it whenever you like. `packages/db/.env` stays, for the Prisma CLI only. Settings that used to be read before `.env` loaded (`BACKUP_DIR`, `SETTINGS_FILE`) now also work from `.env`. Error messages and the Email page now point to the root `.env`. | 9 new config tests (20/20 shared) · your `.env` passes the check · bad PORT/URL and a missing DATABASE_URL each stop the app with exit 1 and the message · test API smoke (health, settings file, backups folder, Gmail off, AI through the fake) · 26/26 API unit tests · typecheck 4/4 · lint 5/5 · full API suite waits for the restart |

**Phase 2 while the ports are exhausted:** porting a route needs the full API contract suite, which can't run until the restart (it opens hundreds of local connections). Until then only infrastructure that can be tested in-process (Hono's `app.request()`, no sockets) is done, plus tiny smoke checks.

| 2026-10-02 | ✅ P2-01 | **Hono is in, in front of Express.** `src/app.ts`: `createApp({ config, prisma, log })` is the composition root (everything comes in through `deps`, so tests pass fakes). Every Hono request gets an id (`X-Request-Id`, kept when the caller sends one) and one structured **pino** log line (`requestId`, method, path, status, ms; `LOG_LEVEL` in `.env`). Errors are **problem+json** (RFC 9457: type, title, status, detail) and also carry `error`, the field the website and the tests read. `src/http/strangler.ts`: Express middleware that hands a request to Hono only when Hono's route table has it, decided **before** the body is read, so Express routes still get an untouched body. `/api/health` is the first route served by Hono. The test helper now parses any JSON content type, problem+json included, and the route checker scans sub-folders. | 9 in-process tests (health, request id, log line, problem+json, strangler routing, body untouched on fall-through) · 35/35 API unit · real-process smoke: health via Hono with a request id, POST /api/tasks via Express with its body intact, Express errors unchanged, log line written · 125/125 routes · typecheck · lint · **full contract suite waits for the restart** |

| 2026-10-02 | ✅ P2-02 | **OpenAPI + API docs.** The Hono app is an `OpenAPIHono` (`@hono/zod-openapi` 1.6, Zod 4). Routes are declared with `createRoute()` and Zod schemas: one schema checks the request, types the handler and documents the route. A request that breaks a schema gets a **400 problem+json with the schema's own message**, so the error texts the API uses today carry over when routes move. `/api/openapi.json` is the OpenAPI 3.1 document; **`/api/docs`** is the Scalar reference page. `/api/health` is documented with a `Health` schema. The route checker understands `createRoute` and `doc31`; the contract tests cover both new routes and `X-Request-Id`. | 3 more in-process tests (38/38 API unit): spec built from the schemas, docs page, schema validation → 400 with the message · real-process smoke: openapi.json 200 (3.1.0) and docs page 200 HTML · 127/127 routes · typecheck · lint · the docs page loads Scalar from a CDN, so viewing it in a browser and the new contract tests wait for the restart |

**TypeScript:** API 0 errors (was 950), website 0 errors (was 1,847). `pnpm typecheck` checks both.

**Still open:** the client has 4 advisories (`esbuild` via Vite 5, `react-router` 6). They need major upgrades, which are planned in P3-01/P3-04 (Vite 6+, TanStack Router).

**⏳ Needs you: restart the computer, then run `pnpm test:e2e`.** On 2026-10-02 Windows ran out of temporary network ports: 15,846 of 16,384 were stuck in TIME_WAIT and never expired (the PC had been up since 2026-08-22). New local connections then hang, so the browser suite can't start its servers. A restart clears it. It isn't a code problem (the API suite and every endpoint passed), but the browser suite has not been re-run since P1-05 (API) and P1-06 (website) because of it. **Please run `pnpm test` after the restart** (API suite + browser suite); both changes are type-level and the build passes, so failures are unlikely, but this is the check that proves it.

**Known issues found (recorded as tests, fixed later in the phase named):**
- P2: a missing id on update/delete gives **500** instead of 404 (Prisma "not found" not mapped).
- P2-16: `textOf` leaves invisible non-breaking spaces in plain-text email bodies (its `&nbsp;` replace never matches).
- P2-11: "find free copies" of a book calls the internet, so only its 404 path is tested. Needs a fake.
- Vite's first-ever run re-optimises dependencies and restarts once. One E2E run hit it; cached since.
- ⚠️ `scripts/stop-all.ps1` force-kills **whatever** listens on ports 4000/5173, including other projects' dev servers (your `var_platform` uses 5173). It should check the process belongs to Hyperfocus. Fix with P5-13 (local mode); until then, be careful running it.
- Windows: `pnpm bootstrap`/`pnpm install` fail with `EPERM` while the app is running (the API locks Prisma's engine file). Stop the app first. Killing `pnpm dev` without Ctrl+C can leave the API and Vite running in the background.
- Flaky (seen once, not reproduced in 4 runs, cold cache included): the Vite dev server exited mid-run during the browser suite (`ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`). It happened on the first run right after a dependency install. Playwright retries once in CI. Watch for it in P1-08.
- `AGENTS.md` is written by Turborepo (instructions for AI agents to read its bundled docs) and was committed with P1-01. To opt out, set `"agentGuidance": false` in `turbo.json` and delete it.

## 0. How to read this file

- **Phases** run in order. Inside a phase, tasks can run in parallel unless `Depends` says otherwise.
- Task IDs look like `P3-07`. Reference them in branch names (`feat/P3-07-tasks-router`) and commit messages.
- **Size:** `S` ≤ ½ day · `M` ≈ 1–2 days · `L` ≈ 3–5 days. Anything bigger than `L` must be split before starting.
- **Definition of Done (every task):** types compile in strict mode · lint is clean · tests are added or updated and green ·
  no feature removed (check §3, Feature Parity) · docs updated if behaviour changed.
- The app must **work at the end of every phase**. No big-bang rewrite (see ADR-001).

---

## 1. Product principles (design thinking)

We follow the Double Diamond: **Discover → Define → Develop → Deliver**, and we keep looping on real student feedback.

**Who we serve**
1. Students of *any* major (engineering, medicine, law, arts, business, education…), not only CS.
2. Students with ADHD (people who live with hyperfocus, time blindness, task paralysis and decision fatigue).

**Design rules that follow from that**
| ADHD challenge | Product rule |
|---|---|
| Decision fatigue | Sensible defaults and **presets everywhere**. One click gets a working setup ("I study Nursing, find me internships"). |
| Overwhelm | **Progressive disclosure**. Advanced filters stay hidden until asked for. Show "Top 5 today", never a 500-item firehose. |
| Time blindness | Visible timers, deadlines shown as "in 3 days" plus a date, gentle reminders. |
| Task paralysis | "Break it down" (already exists: AI steps, Stuck helper). Every big flow has a *tiny first step*. |
| Notification fatigue | **Digests** (daily or weekly) by default. Real-time alerts are opt-in. Quiet hours. |
| Shame or guilt loops | Kind copy, no streak punishment, wins log (already exists), companion pet (already exists). |
| Sensory load | Reduced-motion mode, calm palette, optional dyslexia-friendly font, keyboard-first use. |

**Ethics:** ADHD is health information. We **never ask for or store a diagnosis**. The app is "built for ADHD minds,
useful for everyone". The support chat keeps its crisis safeguard (`isCrisis`) and its messages are treated as sensitive data.

---

## 2. Architecture decisions (ADRs)

| ID | Decision | Why | Rejected alternative |
|---|---|---|---|
| ADR-001 | **Strangler Fig migration**: new modules replace old ones route by route behind the same `/api` paths | The app keeps working at all times. Each step can be reviewed and rolled back. | Big-bang rewrite (high risk, nothing ships for weeks) |
| ADR-002 | **Monorepo**: pnpm workspaces + Turborepo | Shared types and schemas, one CI, cached builds | 3 separate `package.json` files (today) |
| ADR-003 | **Backend: Hono + Zod (`@hono/zod-openapi`)** | TS-first, fast, portable (Node, Docker, edge), produces OpenAPI docs | Express (weak typing), NestJS (heavy for team size) |
| ADR-004 | **Typed API: Hono RPC client** over REST | End-to-end types *and* a normal REST API, so mobile, n8n and partners can call it | tRPC (great typing but a proprietary protocol; a poor fit for n8n webhooks and a public API) |
| ADR-005 | **Architecture: modular monolith** (one deployable, strict feature modules) | Microservice-ready boundaries without microservice cost | Microservices now (premature) |
| ADR-006 | **DB: PostgreSQL + Prisma, with migrations** (`migrate`, not `db push`) | Multi-user concurrency, full-text search, `pg_trgm`, later `pgvector` | SQLite (single writer, local file) |
| ADR-007 | **Auth: Better Auth** (email + Google, sessions in our DB) | TS-native, self-hosted user data, works with Prisma and Hono | Clerk/Auth0 (vendor lock-in, per-user cost) |
| ADR-008 | **Tenancy: row-level `userId`** on every user-owned table, enforced in the repository layer (+ Postgres RLS later) | Simple and proven at our scale | Schema per tenant (overkill) |
| ADR-009 | **Background jobs: pg-boss** (queue stored in Postgres) | No extra infrastructure. Retries, cron, safe with many API instances. | `setInterval` (breaks with >1 instance), BullMQ (needs Redis, so later) |
| ADR-010 | **Frontend: React 19 + Vite + TanStack Router + TanStack Query + Tailwind v4 + shadcn/ui** | Fast dev loop, typed routes, server-state caching, accessible components we own | Next.js (SSR not needed behind login) |
| ADR-011 | **Job ingestion: n8n orchestrates, the backend owns the domain.** n8n fetches on a schedule and POSTs raw batches; the backend normalises, deduplicates, enriches and matches. | Sources can be added without deploys. The business logic stays typed and tested. | All logic inside n8n Code nodes (untestable, untyped) |
| ADR-012 | **No LinkedIn scraping.** LinkedIn only through official, approved API access. Otherwise use licensed job APIs. | LinkedIn's public APIs don't offer job search to general developers, and scraping breaks their Terms of Service. | Scraping (legal and account-ban risk) |
| ADR-013 | **Taxonomy seeded from open standards** (ESCO, O*NET, ISCED-F, CIP–SOC crosswalk, ISO 3166 / GeoNames) | Covers every job and major. Maintained by governments. Multilingual (ESCO). | Hand-typed lists (incomplete, unmaintainable) |
| ADR-014 | **Tooling:** Biome (lint + format), Vitest, Playwright, Docker Compose, GitHub Actions | Fast, minimal config | ESLint + Prettier (slower, more config) |

---

## 3. Feature parity checklist (nothing gets removed)

Every item must work after migration, with a test proving it. Tick only when it is covered by an automated test **and** checked by hand.

> **Live map:** [docs/feature-parity.md](docs/feature-parity.md) links every feature to its tests (39 ✅ · 8 🟡 · 14 ❌ as of P0-04).
> The summary below stays as the quick checklist; the map is the source of truth.

**Plan:** ☐ Today view · ☐ Focus round timer · ☐ Tasks + steps + priorities · ☐ AI "break it down" steps · ☐ Calendar (month/week/day, events, repeats, skip, categories) · ☐ AI natural-language event parse · ☐ Plan my study week · ☐ .ics export · ☐ Reminders (+ repeats) · ☐ My reminders widget
**Grow:** ☐ Goals + actions + logs + AI analysis · ☐ Skills map + AI suggest + AI plan + bulk add · ☐ Study log (timer, pause/resume/continue/stop, past sessions) · ☐ Books (status, find free copies, AI Q&A chat) · ☐ Weekly review (AI)
**Share:** ☐ Notes (kinds, pin, archive) · ☐ LinkedIn posts (AI rewrite, post ideas, schedule, publish via n8n, mark posted, copy fallback) · ☐ Email (rich editor, attachments, templates, Gmail send, AI polish) · ☐ Jobs (status pipeline, follow-ups, linked emails)
**You:** ☐ Support chat (threads, temporary chat, crisis safeguard) · ☐ Stuck helper · ☐ Wins + AI talking points · ☐ Companion pet (XP, stages, wardrobe, items, catalog) · ☐ Music player (80+ generated tracks, 8D, YouTube songs allowlist) · ☐ Quotes · ☐ Profile · ☐ Settings (theme, palettes, gentle lines, notifications) · ☐ Backups · ☐ Demo mode
**Ops:** ☐ Security headers / CSP · ☐ Autostart scripts (kept for self-hosted single-user mode) · ☐ Database viewer

> "Single-user local mode" stays as a supported way to run the app (`MODE=local`): one auto-created owner account, SQLite or a local Postgres in Docker.

---

## 4. Pattern recognition: what the current code tells us

| Observation in today's code | Pattern we apply |
|---|---|
| ~100 routes in one `server/src/index.js`, all the same shape (validate → prisma → json) | **Feature modules** (`modules/<feature>/{routes,service,repository,schemas}.ts`) + a **CRUD route factory** for the simple ones |
| Hand-written validators (`cleanEvent`, `cleanReminder`, `clampLevel`, `parseDate`) | **Zod schemas** in `packages/shared`: one source of truth for API validation, form validation and types |
| `award(...)`, `awardCapture(...)` sprinkled in 16 places (task done → XP → pet) | **Domain events + Observer**: `TaskCompleted` is published and the pet module subscribes. Features stay decoupled. |
| `if (DEMO)` checks in 14 places | **Config object + feature flags** injected at the composition root, no globals |
| `ai.js`: many functions, each building a prompt and calling DeepSeek | **AI Gateway** (Adapter for providers) + **Prompt templates** (Template Method) + per-user rate limits + caching |
| `mail.js` tied to one Gmail app password | **MailProvider** interface (Adapter): `GmailOAuthProvider`, `ResendProvider`, `DryRunProvider` |
| n8n LinkedIn webhook called directly | **Outbound integration port** (`SocialPublisher` interface) |
| `setInterval` for reminders, scheduler, backups | **Job queue** (pg-boss) with idempotent handlers |
| PowerShell desktop toasts | **Notification channels** (Strategy): in-app, web push, email, desktop (local mode only) |
| `api.js` fetch wrapper + `useEffect` loading in each page | **TanStack Query** hooks per feature + the typed Hono client |
| Pet art, clothes, items: large data-in-JSX files | Move the data into typed config modules. Keep the art components as they are. |

**Pattern catalogue we use (and where)**
- *Modular monolith, layered*: Route → Service (use cases) → Repository → Prisma.
- *Repository*: all DB access, **always scoped by `userId`** (tenancy guard in one place).
- *Adapter / Port*: AI providers, mail providers, job sources, social publishers, storage (local disk or S3/R2).
- *Strategy*: notification channel, job-match scoring, AI provider choice.
- *Specification*: job filters, combined with AND/OR/NOT and translated into SQL where possible.
- *Pipeline / Chain of Responsibility*: job ingestion (normalise → dedupe → enrich → classify → match → notify).
- *Observer / domain events* + *Transactional Outbox*: side effects (XP, notifications) fire reliably after commit.
- *Factory*: CRUD router factory, provider factory from config.
- *Template Method*: AI prompt templates.
- *Anti-Corruption Layer*: external job payloads never leak into our domain model.
- *Idempotency keys*: ingestion batches and notification sends.
- *Composition root / DI*: one `createApp(deps)` function, so tests swap in fakes.

---

## 5. Target structure

```
hyperfocus/
├─ apps/
│  ├─ api/                 Hono app (Node). src/modules/<feature>/…, src/jobs/…, src/app.ts (composition root)
│  └─ web/                 React 19 + Vite. src/features/<feature>/…, src/routes/…, src/components/ui (shadcn)
├─ packages/
│  ├─ shared/              Zod schemas, DTO types, enums, domain event types, constants
│  ├─ db/                  prisma/schema.prisma, migrations, seed/, taxonomy importers, Prisma client export
│  ├─ ai/                  AI gateway + prompt templates (used by api)
│  ├─ config/              tsconfig bases, biome config
│  └─ ui/ (optional)       shared design tokens if we add a mobile app later
├─ integrations/n8n/       workflow JSON exports (LinkedIn post, Job Radar ingestion) + README
├─ infra/                  docker-compose.yml, Dockerfiles, deploy notes
├─ scripts/                existing PowerShell scripts (kept), migration scripts
└─ TASKS.md
```

---

## Phase 0: Safety net & discovery  *(before touching code)*

| ID | Task | Size | Depends | Acceptance |
|---|---|---|---|---|
| ✅ P0-01 | Turn the smoke script into an **API contract test suite** (Vitest + fetch) covering every current route: happy path, validation errors, 404s | L | – | Runs against the current Express API, all green, in CI |
| ✅ P0-02 | **Snapshot response shapes** of every GET route (JSON schema snapshots) | M | P0-01 | Snapshots committed. They become the contract the new API must match. |
| ✅ P0-03 | **Playwright smoke** for all 21 pages: loads, no console errors, one key action per page | M | – | Green locally and in CI |
| ✅ P0-04 | Fill in §3 Feature Parity with links to the tests covering each item | S | P0-01, P0-03 | Every row links to a test |
| ✅ P0-05 | Fix known bug: email/job/post detail pages hang on "Loading…" for a missing ID (copy the Books not-found pattern) | S | – | Test: bad ID shows a not-found state |
| ✅ P0-06 | `npm audit fix` for the server (deepmerge-ts) | S | P0-01 | Audit shows 0 high in server, tests green |
| ⏳ P0-07 | **Discovery (design thinking):** 8–12 short interviews with students (≥5 majors, ≥half with ADHD or ADHD traits). Topics: studying, planning, job hunting. | L | – | Notes + an affinity map in `docs/research/` |
| ⏳ P0-08 | Write 4 **personas** + a **journey map** for "find an internship" and "survive exam week" | M | P0-07 | `docs/research/personas.md` |
| ✅ P0-09 | Define success metrics: weekly active students, tasks done/week, job matches saved → applied, D30 retention | S | P0-08 | `docs/metrics.md` |
| ✅ P0-10 | Freeze a **backup of the current `dev.db`** and record the migration rehearsal steps | S | – | Backup stored outside the repo, steps in `docs/migration.md` |

## Phase 1: Monorepo & TypeScript foundation

| ID | Task | Size | Depends | Acceptance |
|---|---|---|---|---|
| ✅ P1-01 | Create a branch, switch to **pnpm workspaces + Turborepo**, move `client→apps/web`, `server→apps/api`. No code changes yet. | M | P0-01 | `pnpm dev` runs both. All P0 tests green. |
| ✅ P1-02 | `packages/config`: strict `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Biome config | S | P1-01 | `pnpm lint` and `pnpm typecheck` wired through Turbo |
| ✅ P1-03 | `packages/db`: move Prisma schema, export the typed client | S | P1-01 | API imports `@hyperfocus/db` |
| ✅ P1-04 | `packages/shared`: set up Zod. Add the first schemas (Task, Step, Note) as a pilot. | S | P1-01 | Imported by both apps |
| ✅ P1-05 | Convert **apps/api** JS → TS file by file, behaviour unchanged (`tsx watch` in dev, `tsup` build) | L | P1-02 | 0 `any` in new code (`// TODO(types)` allowed temporarily). Tests green. |
| ✅ P1-06 | Convert **apps/web** JS → TS/TSX page by page, behaviour unchanged | L | P1-02 | `tsc --noEmit` clean, Playwright green |
| ✅ P1-07 | Rename packages from `thought-studio` → `@hyperfocus/*` | S | P1-01 | – |
| ⏳ P1-08 | **GitHub Actions CI**: install → typecheck → lint → unit → contract → Playwright, with Turbo cache | M | P1-05 | Required check on `main` |
| ✅ P1-09 | Pre-commit hook (lefthook): biome + typecheck on staged packages | S | P1-02 | – |
| ✅ P1-10 | Typed **config module** (`packages/shared/config` with a Zod-validated env). Merge root and server `.env` into one source. | S | P1-05 | App refuses to start with a clear message if env is invalid |

## Phase 2: Backend re-architecture (Express → Hono, modular monolith)

| ID | Task | Size | Depends | Acceptance |
|---|---|---|---|---|
| ✅ P2-01 | `apps/api` skeleton: `createApp(deps)` composition root, Hono, error middleware (problem+json), request ID, structured logging (pino) | M | P1-05 | Health route served by Hono **alongside** Express (strangler: Hono mounts first, falls through to Express) |
| ✅ P2-02 | OpenAPI setup (`@hono/zod-openapi`) + Scalar API docs at `/api/docs` | S | P2-01 | Docs render |
| P2-03 | **CRUD router factory** (list/get/create/update/delete from a Zod schema + repository) | M | P2-01 | Unit-tested, used by ≥3 modules |
| P2-04 | **Domain event bus** (in-process, typed) + `TaskCompleted`, `StudySessionEnded`, `WinAdded`, `PostPublished`, … | M | P2-01 | Pet XP moves to subscribers. All 16 `award*` call sites are replaced. |
| P2-05 | **AI gateway** in `packages/ai`: provider interface, DeepSeek adapter, prompt templates, timeouts, retries, typed outputs (Zod-parsed) | L | P2-01 | All `ai.js` functions ported, with fake-provider tests |
| P2-06 | Port module: **notes** | S | P2-03 | Contract tests green against Hono |
| P2-07 | Port module: **tasks + steps** | M | P2-03, P2-04 | " |
| P2-08 | Port module: **goals + actions + logs** | M | P2-03 | " |
| P2-09 | Port module: **skills** (+ suggest, plan, bulk) | M | P2-05 | " |
| P2-10 | Port module: **study sessions** (state machine: running → paused → stopped) | M | P2-04 | State transitions unit-tested |
| P2-11 | Port module: **books** (+ find, ask, chat) | M | P2-05 | " |
| P2-12 | Port module: **calendar/events** (+ parse, plan, ics, repeats, skip) | L | P2-05 | Repeat logic unit-tested |
| P2-13 | Port module: **reminders** | S | P2-03 | " |
| P2-14 | Port module: **wins + reviews** | M | P2-05 | " |
| P2-15 | Port module: **posts** (+ schedule, publish via `SocialPublisher` port, n8n adapter) | M | P2-05 | " |
| P2-16 | Port module: **emails + templates + attachments** (behind a `MailProvider` port, Gmail app-password adapter for now) | L | P2-03 | " |
| P2-17 | Port module: **jobs (applications)** | S | P2-16 | " |
| P2-18 | Port module: **chat** (threads, crisis safeguard kept and tested) | M | P2-05 | Crisis path has explicit tests |
| P2-19 | Port module: **pet** (state, catalog, wardrobe) | M | P2-04 | " |
| P2-20 | Port module: **profile, settings, backups, notify, health, demo mode** (demo becomes a config flag) | M | P1-10 | " |
| P2-21 | Replace `setInterval` loops with a **scheduler interface** (in-process for now, pg-boss in P4) | S | P2-13, P2-15 | Reminders, scheduler and backups still fire |
| P2-22 | **Remove Express** once every route is served by Hono | S | P2-06…P2-21 | Express gone from deps, all tests green |
| P2-23 | Security: rate limiting, body size limits per route, CORS from config, security headers moved into middleware | S | P2-22 | – |

## Phase 3: Frontend re-architecture

| ID | Task | Size | Depends | Acceptance |
|---|---|---|---|---|
| P3-01 | Install **Tailwind v4 + shadcn/ui**. Map the existing CSS variables/palettes (`palettes.js`, `theme.js`) to shadcn tokens. Light/dark/auto kept. | M | P1-06 | Existing palettes selectable, no visual regression on 3 key pages |
| P3-02 | **Design system page** (`/dev/ui`): buttons, inputs, cards, dialogs, toasts, empty states, all with ADHD rules (calm, clear focus rings, reduced motion) | M | P3-01 | Reviewed against WCAG 2.2 AA |
| P3-03 | **Typed API client** (Hono RPC) + **TanStack Query** setup (query keys factory, error toasts, optimistic update helper) | M | P2-02 | Replaces `api.js` |
| P3-04 | **TanStack Router** with typed routes for all 21 current routes, lazy loading kept | M | P3-03 | Every URL still works (old links don't break) |
| P3-05 | **Feature-sliced folders**: `features/<x>/{api.ts, hooks.ts, components/, pages/}` | S | P3-04 | Lint rule: features don't import each other's internals |
| P3-06 | Forms: react-hook-form + shared Zod schemas | S | P1-04 | Same validation messages as the server |
| P3-07 | Migrate pages: Today, Tasks, Notes | L | P3-03…06 | Parity tests green |
| P3-08 | Migrate pages: Calendar, Reminders | L | " | " |
| P3-09 | Migrate pages: Goals, Skills, Study, Review | L | " | " |
| P3-10 | Migrate pages: Books + BookDetail | M | " | " |
| P3-11 | Migrate pages: Posts + PostEditor | M | " | " |
| P3-12 | Migrate pages: Emails + EmailEditor (rich editor kept; evaluate Tiptap behind the same component API) | L | " | " |
| P3-13 | Migrate pages: Jobs + JobDetail | M | " | " |
| P3-14 | Migrate pages: Chat, Wins, Profile, Settings/Backup | L | " | " |
| P3-15 | Migrate **Pet** (PetArt/Clothes/Items/Wardrobe/Widget): typed data configs, art untouched | L | " | Pixel-compare screenshots for all stages |
| P3-16 | Migrate **Music player** + audio engine to TS (engine logic untouched), keep the CSP sandbox for YouTube | M | " | All 80+ tracks play. Songs allowlist kept. |
| P3-17 | Mobile/phone layout pass with Tailwind (current `shell.css` phone layer) | M | P3-07…16 | Playwright mobile project green |
| P3-18 | Accessibility settings: reduced motion, dyslexia-friendly font option, larger text, focus mode (hides the sidebar) | M | P3-02 | Persisted per user |
| P3-19 | i18n-ready strings (`i18next`) + RTL support in layout (prepares Arabic/French later) | M | P3-07…16 | Pseudo-locale test passes |
| P3-20 | Delete old CSS/JS only after its replacement is verified | S | all P3 | – |

## Phase 4: Data platform (Postgres, migrations, jobs, storage)

| ID | Task | Size | Depends | Acceptance |
|---|---|---|---|---|
| P4-01 | `infra/docker-compose.yml`: Postgres 17 (+ pgAdmin optional) | S | – | `pnpm db:up` |
| P4-02 | Switch Prisma provider → PostgreSQL, create the **baseline migration** | M | P2-22, P4-01 | `prisma migrate dev` clean |
| P4-03 | **Data migration script** SQLite → Postgres (your real data). Rehearse twice on backup copies. | M | P4-02, P0-10 | Row counts and checksums match per table |
| P4-04 | Indexes for hot queries (tasks by day, events by range, notes by kind) | S | P4-02 | EXPLAIN plans attached to the PR |
| P4-05 | **pg-boss** queue: move reminders, post scheduler, digests and backups onto it (idempotent handlers) | M | P2-21, P4-02 | Safe with 2 API instances (tested) |
| P4-06 | **Transactional outbox** for domain events that trigger external side effects | M | P4-05 | No lost or duplicate notifications in tests |
| P4-07 | **Storage port**: local disk (local mode) / S3-compatible R2 (cloud) for email attachments | M | P2-16 | Attachments survive redeploys |
| P4-08 | Backups: keep the local-mode feature. In cloud mode use the provider's PITR + per-user "Export my data" (JSON + attachments zip). | M | P4-02 | Export reimports cleanly |

## Phase 5: Users, auth & multi-tenancy

| ID | Task | Size | Depends | Acceptance |
|---|---|---|---|---|
| P5-01 | **Better Auth**: email + password, email verification, Google OAuth, sessions, password reset | L | P4-02 | Sign up / in / out / reset E2E-tested |
| P5-02 | Add `userId` (FK, indexed) to **every** user-owned model (24 models listed in §3). Migration assigns existing rows to the owner account. | L | P5-01 | Migration reversible, counts preserved |
| P5-03 | **Tenancy guard** in the repository base: every query is scoped by `ctx.userId`, so unscoped access cannot compile | M | P5-02 | Test: user A can never read or update user B's data, for every module (generated test) |
| P5-04 | Auth middleware + `ctx.user` in Hono. 401/403 handling in the web client, protected routes. | M | P5-01 | – |
| P5-05 | Onboarding flow (ADHD-friendly, ≤3 screens): name, major (from taxonomy), what you want help with. Picks presets automatically. | M | P5-01, P6-03 | Finishes in <60s in usability tests |
| P5-06 | Roles: `user`, `admin` (admin: taxonomy management, provider health, feature flags) | M | P5-04 | – |
| P5-07 | Per-user secrets/integrations table (encrypted at rest: Gmail OAuth tokens, LinkedIn tokens) | M | P5-02 | Key rotation documented |
| P5-08 | Gmail **OAuth per user** (`MailProvider` Gmail-OAuth adapter). App-password adapter kept for local mode. | L | P5-07 | Sending from 2 test accounts works |
| P5-09 | LinkedIn posting **per user** (each user connects their own LinkedIn via OAuth "Share on LinkedIn") | M | P5-07 | – |
| P5-10 | **AI quotas** per user (daily token/request budget), usage table, friendly "come back tomorrow" UX | M | P2-05 | – |
| P5-11 | Notification channels per user: in-app, email digest, web push (PWA), quiet hours. Desktop toasts only in local mode. | L | P4-05 | – |
| P5-12 | Privacy: privacy policy, data export, **account deletion** (the only "delete" we add, legally required), chat data retention settings | M | P4-08 | GDPR-style requests handled |
| P5-13 | Local mode (`MODE=local`): auto-login owner, no signup, works offline like today | S | P5-04 | Your current workflow is unchanged |

## Phase 6: Job Radar (new feature)

### 6A. Compliance first
| ID | Task | Size | Depends | Acceptance |
|---|---|---|---|---|
| P6-01 | **Source legal review**: check ToS/licence of each job source and record attribution, caching and display rules in `docs/job-sources.md`. LinkedIn: apply for official partner access; **no scraping** (ADR-012). | M | – | Signed-off source list |
| P6-02 | Pick launch sources from the approved list. Candidates: Adzuna API, Jooble API, Careerjet, USAJobs, Remotive, Arbeitnow, The Muse, public ATS boards (Greenhouse / Lever / Ashby / Workable job-board APIs), JSearch (RapidAPI). Add regional boards for your launch country. | S | P6-01 | ≥3 sources live in staging |

### 6B. Taxonomy preset (the "everything" database)
Seeded from open standards, so it covers every job, major and skill and can be updated:

| Dataset | Gives us | Licence |
|---|---|---|
| **ESCO** (EU) | ~3,000 occupations, ~14,000 skills/knowledge items, alt labels, occupation↔skill links (essential/optional), 25+ languages | Free, attribution |
| **O\*NET** (US DoL) | ~1,000 occupations, tens of thousands of alternate job titles, technology skills, education/experience requirements | CC BY 4.0 |
| **ISCO-08 / SOC** | Occupation groups (for the browse tree) | Open |
| **ISCED-F 2013 + CIP** | Fields of study / majors, international + US detail | Open |
| **CIP–SOC crosswalk** (NCES/BLS) | **Major → occupations** mapping ("I study Biology → these jobs") | Public domain |
| **ISO 3166 + GeoNames** | Countries, cities | CC BY 4.0 |

| ID | Task | Size | Depends | Acceptance |
|---|---|---|---|---|
| P6-03 | Prisma models: `Occupation`, `OccupationTitle` (alt titles, per language), `TaxonomySkill` (type: skill / knowledge / tool / language / certification), `OccupationSkill` (relation + importance), `OccupationGroup` (tree), `FieldOfStudy`, `FieldOfStudyOccupation`, `Industry`, `Country`, `City`, enums `EmploymentType` (full-time, part-time, internship, apprenticeship, contract, freelance, volunteer, student job), `Seniority` (student, intern, entry, junior, mid, senior, lead), `WorkMode` (onsite, hybrid, remote), `EducationLevel` | M | P4-02 | Migration + ERD in `docs/` |
| P6-04 | **Importer CLI** (`pnpm taxonomy:import esco|onet|cip|geo`): streaming CSV import, idempotent upserts, versioned (`taxonomyVersion`) | L | P6-03 | Re-running changes 0 rows. Import < 5 min. |
| P6-05 | Cross-map ESCO ↔ O*NET occupations (official ESCO–O*NET crosswalk) to dedupe titles | M | P6-04 | – |
| P6-06 | Search indexes: `pg_trgm` + full-text over titles/skills (multilingual), typeahead endpoint `<50ms p95` | M | P6-04 | – |
| P6-07 | **Student starter presets**: for each field of study, generate a ready-made filter (top occupations + entry/intern seniority + core skills). Curate the top 40 majors by hand. | L | P6-05 | One-click preset per major |
| P6-08 | Link the existing **Skills map** (user `Skill` model) to `TaxonomySkill` optionally (keep free-text skills) | M | P6-04 | Old skills untouched, new ones can be linked |
| P6-09 | Admin UI: browse/edit taxonomy, add local job titles, merge duplicates | M | P5-06 | – |

### 6C. Ingestion pipeline (n8n + backend)
```
n8n Schedule (every 30–60 min per source)
  → HTTP Request (source API, paginated, since last cursor)
  → POST /api/v1/ingest/jobs   { source, cursor, items: [raw…] }   HMAC-signed + idempotency key
Backend pipeline (pg-boss jobs):
  normalise (per-source Adapter → JobPosting DTO)
  → dedupe (source+externalId, then content hash + fuzzy title/company/location)
  → enrich (skill extraction: dictionary match over TaxonomySkill labels; optional AI pass, cached by hash)
  → classify (occupation, seniority, employment type, work mode, salary parse)
  → store → match against all active user filters → queue notifications (digest)
```
| ID | Task | Size | Depends | Acceptance |
|---|---|---|---|---|
| P6-10 | Models: `JobSource`, `JobPosting` (normalised fields + `raw` JSONB + `contentHash` + `expiresAt`), `JobPostingSkill`, `IngestBatch` (cursor, counts, errors) | M | P6-03 | – |
| P6-11 | **Ingest endpoint**: HMAC signature, idempotency key, batch size limits, 202 Accepted + queued | M | P6-10, P4-05 | Replaying a batch creates 0 duplicates |
| P6-12 | **Source adapters** (Anti-Corruption Layer): one adapter per source → `JobPostingDTO` (Zod). Contract tests with recorded fixtures. | L | P6-11 | ≥3 adapters |
| P6-13 | Dedupe service (exact + fuzzy) | M | P6-12 | Precision ≥ 95% on a labelled sample |
| P6-14 | Skill extractor: Aho-Corasick over taxonomy labels/alt labels (multilingual) + optional AI enrichment via the AI gateway (budgeted) | L | P6-04, P2-05 | Measured on 200 labelled postings |
| P6-15 | Classifier: seniority / employment type / work mode / salary / education from text + source fields | M | P6-12 | – |
| P6-16 | **n8n workflow** `integrations/n8n/job-radar-ingest.workflow.json`: schedule, per-source branch, pagination, retry/backoff, error workflow → alert. Exported and versioned. | M | P6-11 | Imports cleanly. README updated. |
| P6-17 | Retention: expire postings (e.g. 45 days) and archive them, respecting each source's caching rules | S | P6-10 | – |
| P6-18 | Provider health dashboard (admin): last run, items, errors per source | S | P6-16, P5-06 | – |
| P6-19 | `LinkedInJobsProvider` adapter **interface + feature flag only**, enabled once official access is granted (ADR-012) | S | P6-12 | Disabled by default |

### 6D. User filters & matching
Filter options (all user settings, all optional, with presets prefilled):
**Titles/occupations** (taxonomy pick + free text) · **keywords include / exclude** (scope: title, description, requirements) ·
**skills** must-have / nice-to-have (taxonomy) · **requirements**: max years of experience, education level, languages ·
**field of study** · **employment type** · **seniority** · **work mode** · **locations** (+ radius) · **salary minimum** (+ currency) ·
**company include / exclude** · **industry** · **posted within** · **visa / sponsorship** (if the source provides it) · **digest frequency**.

| ID | Task | Size | Depends | Acceptance |
|---|---|---|---|---|
| P6-20 | Models: `JobFilter` (per user, many allowed, name, enabled, JSON spec validated by a Zod schema in `packages/shared`), `JobMatch` (filter, posting, score, reasons, status: new / seen / saved / dismissed / applied) | M | P6-10, P5-02 | – |
| P6-21 | **Specification engine**: filter spec → composable specs → Prisma `where` (hard filters pushed to SQL) + in-memory specs for the rest | L | P6-20 | Unit-tested per filter type |
| P6-22 | **Scoring Strategy**: weighted skill overlap (essential > optional), title similarity to occupation alt titles, keyword hits, recency. Returns **explainable reasons** ("Matches: Python, internship, remote"). | L | P6-21 | Reasons shown for every match |
| P6-23 | Matching jobs: new posting → match against active filters (batched). New/edited filter → backfill the last N days. | M | P6-21, P4-05 | Handles 10k postings × 10k filters in a load test |
| P6-24 | **Digest**: daily or weekly "Top 5 for you" (in-app + email), real-time opt-in, quiet hours, max N per day | M | P6-23, P5-11 | – |
| P6-25 | "Save → Apply" bridge: a matched job becomes a **Job application** (existing Jobs feature) with one click, and email templates are suggested | S | P6-20, P2-17 | – |
| P6-26 | Feedback loop: 👍/👎 per match adjusts that user's weights | M | P6-22 | – |

### 6E. Job Radar UI (ADHD-first)
| ID | Task | Size | Depends | Acceptance |
|---|---|---|---|---|
| P6-27 | **Radar page**: "Top picks today" (max 5), then "More" behind a click. Card: title, company, why it matches, deadline-in-days, Save / Not for me / Apply. | L | P6-22, P3-02 | Usability test: 5 students, none lost |
| P6-28 | **Filter builder**: starts from a preset ("I study ___, I want ___"), simple mode (3 fields) / advanced mode (everything above). Live "≈ N jobs/week" preview. | L | P6-07, P6-21 | – |
| P6-29 | Taxonomy typeahead components (occupations, skills, majors, locations) | M | P6-06 | Keyboard-only usable |
| P6-30 | Tie into existing features: a saved job's deadline goes to Calendar + Reminder. "Prepare" creates Tasks with AI steps. Gaps become Skills map items. | M | P6-25 | The pet gets XP for applying (domain event) |
| P6-31 | Empty and edge states: no matches ("widen location?"), source down, quota reached | S | P6-27 | – |

## Phase 7: Deploy & operate

| ID | Task | Size | Depends | Acceptance |
|---|---|---|---|---|
| P7-01 | Dockerfiles (api, web static) + production compose | M | P5 | `docker compose up` = full stack |
| P7-02 | Environments: local / staging / production. Secrets in the hosting provider, never in the repo. | S | P7-01 | – |
| P7-03 | Deploy: web → Vercel or Cloudflare Pages · api + worker → Fly.io / Railway · Postgres → Neon / Supabase · n8n → n8n Cloud or self-hosted container · storage → R2 | M | P7-01 | Staging live |
| P7-04 | Observability: Sentry (web + api), structured logs, uptime checks, queue metrics | M | P7-03 | Alert on error spike |
| P7-05 | CD: merge to `main` → staging, tag → production, migrations run as a release step | M | P7-03 | – |
| P7-06 | Load test (k6): 1k concurrent users on core flows + the ingestion burst | M | P7-03 | p95 < 300ms core API |
| P7-07 | Security review: OWASP ASVS L1 checklist, dependency scanning (Dependabot), secret scanning | M | P7-03 | – |
| P7-08 | Beta launch: 30 students (≥5 majors), feedback loop back to P0-07 (design thinking iterate) | L | all | Metrics from P0-09 tracked |

---

## 7. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| LinkedIn job data not available via the official API | High | ADR-012: licensed aggregators + ATS boards. LinkedIn adapter ready behind a flag. |
| Scope is huge | High | Strict phases. Each ends with a working app. Job Radar can start in parallel after P5-02. |
| Data loss during the SQLite → Postgres move | High | P0-10 backup, P4-03 rehearsed twice with checksums |
| Feature silently dropped during the rewrite | High | §3 parity checklist backed by tests (P0-01…04) |
| AI cost grows with users | Medium | P5-10 quotas, caching by content hash, cheap model by default |
| Taxonomy is US/EU-centric | Medium | P6-09 admin adds local titles. ESCO is multilingual. Add Arabic/French labels over time. |
| Sensitive data (chat, mental health) | High | P5-12 privacy, encryption at rest, minimal logging of chat content |

## 8. Suggested order of work (first 2 weeks)

1. P0-01 → P0-02 → P0-03 → P0-05 (safety net, quick win)
2. P0-07 / P0-08 in parallel (talk to students while engineering starts)
3. P1-01 → P1-02 → P1-03/04 → P1-05 → P1-08
4. P2-01 → P2-02 → P2-03 → P2-06 (first module on Hono, end to end)
