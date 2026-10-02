# Hyperfocus 💜

Personal, local-only app: capture thoughts, manage tasks, turn ideas into LinkedIn posts with DeepSeek.

**Stack:** React (Vite) · Hono · Prisma + PostgreSQL (installed on this computer, no Docker) · DeepSeek API · n8n for LinkedIn posting.

## Run
Needs Node 24+ and pnpm (`npm install -g pnpm`; the repo pins the exact version).
```
pnpm bootstrap  # first time only: installs everything and creates the database
pnpm dev        # API + website together: http://localhost:5173
```
If port 5173 is taken, run with another one: `WEB_PORT=5174 pnpm dev` (PowerShell: `$env:WEB_PORT=5174; pnpm dev`).

## Test
```
pnpm test       # everything: API tests, then browser tests
pnpm test:api   # API + unit tests only (fast)
pnpm test:e2e   # browser tests only (uses your installed Chrome)
pnpm test:visual  # screenshots of key pages vs the saved ones (add --update-snapshots after a deliberate change)
pnpm lint       # Biome linter (config and the reason for every relaxed rule: biome.jsonc)
pnpm typecheck  # TypeScript, strict (shared configs in packages/config)
pnpm check      # lint + typecheck + tests, what CI runs
```
Tests run against a throwaway database with fake AI and n8n, so they never touch your data, spend credits or post anything.
GitHub Actions runs the same checks on every push and pull request (`.github/workflows/ci.yml`).

A git hook (lefthook, installed by `pnpm install`) lints your staged files and typechecks the packages you changed before each
commit (`lefthook.yml`). It takes a second or two. `git commit --no-verify` skips it once.

## Config (`.env` at the project root)
Copy `.env.example` to `.env` and fill it in. The API checks it at start-up and refuses to start, with a clear message, if a
value is wrong (for example a PORT that isn't a number). Real environment variables win over the file. An old `apps/api/.env`
is still read for now, but you can delete it once its values are in the root `.env`.

- `DEEPSEEK_API_KEY` – from https://platform.deepseek.com/api_keys
- `N8N_WEBHOOK_URL` – see `n8n/README.md`. Empty = the POST button copies the draft and opens LinkedIn.

- `GMAIL_USER` – your Gmail address, and `GMAIL_APP_KEY` – an App Password from https://myaccount.google.com/apppasswords (needs 2-Step Verification). Used by the Email page.

Back up your data with Settings → Backup (a backup is also made automatically every day).

## Start automatically
```
powershell -ExecutionPolicy Bypass -File scripts\install-autostart.ps1     # once
```
Then n8n and Hyperfocus start hidden when you log in, and a "Hyperfocus" shortcut on the Desktop opens the website.
- `scripts\stop-all.ps1` stops the app (add `-IncludeN8n` to stop n8n too)
- `scripts\uninstall-autostart.ps1` removes the shortcuts
- Logs: `logs\`

## Backups
Sidebar → Backup. A copy of the database is also made automatically once a day into `backups\` (newest 30 kept).
To restore: stop the app, run `pnpm db:restore backups\thought-studio-….dump`, start the app.
(Backups from before the move to PostgreSQL end in `.db`: they are SQLite files, kept and downloadable.)

## Look at your data (the database)
Your data is in the PostgreSQL on this computer (database `hyperfocus`). To browse and edit it as tables:
```
powershell -ExecutionPolicy Bypass -File scripts\open-database.ps1       # opens http://localhost:5555
powershell -ExecutionPolicy Bypass -File scripts\open-database.ps1 -Stop # closes it
```
(Another way: pgAdmin, which comes with PostgreSQL: server localhost, user `hyperfocus`, password `hyperfocus-local`.)

## The music player
- **Generated music** (80+ tracks): made live in the browser with the Web Audio API, no audio files. See `apps/web/src/features/music/audio/`:
  `engine.ts` (the synth, composer, noise, 8D spinner), `tracks.ts` (the library: each track is a small recipe).
- **Songs**: real songs play in YouTube's own embedded player (`songs.ts` is the allowlist of video IDs). The frame is sandboxed,
  uses youtube-nocookie.com, and loads only when a song is played. `apps/web/security-headers.mjs` limits what the site may load.

## How the code is organised
- `apps/web/src/features/<feature>/` one folder per feature (`pages/`, `components/`, `hooks/`); other code may only use what its `index.ts` exports (checked by `pnpm lint`). Pages load only when opened (`router.tsx`). `api.ts` per feature holds its data hooks (TanStack Query); `components/` shared pieces (`ui/` = shadcn/ui), `api/` the typed API client and data cache, `features/music/` the player and its audio engine, `i18n/` the translatable words (`en.ts`; try `?lang=en-XA` or `?lang=ar-XB`), `data/` words and lists.
  Everything is TypeScript: `api.ts` is the fetch wrapper (`api.get<Task[]>("/tasks")`) and `types.ts` describes what the API sends back.
- `apps/web/src/shell.css` the layout, spacing variables (`--s-*`) and phone layer; `styles.css` the base design and colors.
- `apps/api/src/index.ts` the API (TypeScript, run directly by Node 24, no build step); one small file per topic next to it (`pet.ts`, `books.ts`, `reminders.ts`, ...). Shared API types are in `types.ts`. Data model: `packages/db/prisma/schema.prisma`.
  The API is moving from Express to **Hono** route by route: `app.ts` is the new app (`createApp(deps)`), and
  `http/strangler.ts` sends each request to Hono when Hono has that route, otherwise to Express. Settings: `config.ts`.
  API documentation for the Hono routes: http://localhost:4000/api/docs (spec: `/api/openapi.json`).
- `apps/api/test/` API contract, unit and shape tests; `e2e/` browser tests. `docs/` plans and research; `TASKS.md` the refactor plan and progress.
- `scripts/` start, stop, backups, demo, sharing, the database opener and `db-fingerprint.mjs` (proves two databases hold the same data).
- The repo is a pnpm workspace run by Turborepo (`pnpm-workspace.yaml`, `turbo.json`).
