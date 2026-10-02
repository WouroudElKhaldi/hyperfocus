# Data safety & migration rehearsal (P0-10)

Your data is one SQLite file today: `packages/db/prisma/dev.db` (it was `server/prisma/dev.db` before the refactor). This page says how it's protected during the refactor
and how the move to PostgreSQL (P4-03) will be rehearsed and **proven** lossless before it touches your real data.

## 1. The frozen pre-refactor backup

| | |
|---|---|
| File | `%USERPROFILE%\hyperfocus-backups\pre-refactor-2026-10-02.db` (outside the repo, so no git command can touch it) |
| Made with | `sqlite3 server/prisma/dev.db ".backup '<file>'"`, a consistent copy even while the app runs |
| Checked | `PRAGMA integrity_check` = ok · fingerprint identical to `dev.db` (see below) |
| Contents at the time | 1 chat thread with 2 messages; every other table empty (fresh clone) |

> **If your real data lives on another machine** (this repo was just cloned), copy that machine's `server/prisma/dev.db` (old layout) to `packages/db/prisma/dev.db`
> (or a file from its `backups/` folder) here **before P4**, then make a new frozen backup the same way.

## 2. Fingerprints: proving nothing was lost

`node scripts/db-fingerprint.mjs [file.db] [--json]` prints, for every table, the row count and a checksum of all its rows.
Same fingerprint = same data. Use it:
- after making any backup (backup vs. live DB),
- before and after every phase that touches the database,
- in P4-03, against a fingerprint computed the same way from PostgreSQL (the P4-03 script will add a `--postgres` mode
  that normalises values identically: dates → epoch ms, blobs → hex).

## 3. Restore (if anything goes wrong)

1. Stop the app (`scripts\stop-all.ps1`, or stop `pnpm dev` with Ctrl+C).
2. Copy the backup over `packages\db\prisma\dev.db`.
3. Start the app and check the fingerprint matches the backup's.

## 4. SQLite → PostgreSQL rehearsal plan (for P4-03)

Run the whole thing **twice on copies** before doing it for real. Never on the only copy.

1. **Freeze:** stop the app, take a new backup, record its fingerprint (`--json > before.json`).
2. **Schema:** create an empty Postgres (Docker, P4-01) and apply the baseline migration (P4-02).
3. **Copy:** run the migration script table by table in dependency order (parents before children), keeping ids
   and resetting each Postgres id sequence to `max(id)+1` afterwards.
   Order: Note, Task, Step, Post, StudySession, Goal, GoalAction, GoalLog, Event, Book, BookMessage, Skill, Review, Win,
   Pet, PetXp, ChatThread, ChatMessage, Profile, Reminder, JobApplication, Email, EmailTemplate, EmailAttachment.
4. **Verify:** fingerprint Postgres (`after.json`) and diff with `before.json`. **Any difference stops the migration.**
5. **Smoke:** point the app at Postgres, run the API contract tests' read-only checks and open every page (P0-03 suite).
6. **Keep the SQLite file** untouched for at least 30 days after the real migration.

Things to watch (SQLite → Postgres differences):
- `DateTime` is stored as epoch ms in SQLite and as `timestamp(3)` in Postgres. Compare as epoch ms.
- Text comparisons are case-sensitive in Postgres (`LIKE` vs `ILIKE`); review any search queries.
- `EmailAttachment.data` is a blob → `bytea`. Large files should move to object storage in P4-07, not stay in the DB.
- `Settings` live in `server/settings.json`, not the DB. Migrate them separately (into a per-user settings table in P5).
