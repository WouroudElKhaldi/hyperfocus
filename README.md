# Hyperfocus 💜

Personal, local-only app: capture thoughts, manage tasks, turn ideas into LinkedIn posts with DeepSeek.

**Stack:** React (Vite) · Express · Prisma + SQLite (a single file: `server/prisma/dev.db`) · DeepSeek API · n8n for LinkedIn posting.

## Run
```
npm run setup   # first time only
npm run dev     # http://localhost:5173
```

## Config (`server/.env`)
- `DEEPSEEK_API_KEY` – from https://platform.deepseek.com/api_keys
- `N8N_WEBHOOK_URL` – see `n8n/README.md`. Empty = the POST button copies the draft and opens LinkedIn.

- `GMAIL_USER` – your Gmail address, and `GMAIL_APP_KEY` – an App Password from https://myaccount.google.com/apppasswords (needs 2-Step Verification). Used by the Email page.

Back up your data by copying `server/prisma/dev.db`.

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
To restore: stop the app, copy a backup over `server\prisma\dev.db`, start the app.

## Look at your data (the database)
Your data is one SQLite file: `server/prisma/dev.db`. To browse and edit it as tables:
```
powershell -ExecutionPolicy Bypass -File scripts\open-database.ps1       # opens http://localhost:5555
powershell -ExecutionPolicy Bypass -File scripts\open-database.ps1 -Stop # closes it
```
(Another way: install the free "DB Browser for SQLite" and open a copy of the file from `backups\`.)

## The music player
- **Generated music** (80+ tracks): made live in the browser with the Web Audio API, no audio files. See `client/src/audio/`:
  `engine.js` (the synth, composer, noise, 8D spinner), `tracks.js` (the library: each track is a small recipe).
- **Songs**: real songs play in YouTube's own embedded player (`songs.js` is the allowlist of video IDs). The frame is sandboxed,
  uses youtube-nocookie.com, and loads only when a song is played. `client/security-headers.mjs` limits what the site may load.

## How the code is organised
- `client/src/pages/` one file per page, loaded only when opened. `components/` shared pieces. `audio/` the music. `data/` words and lists.
- `client/src/shell.css` the layout, spacing variables (`--s-*`) and phone layer; `styles.css` the base design and colors.
- `server/src/index.js` the API; one small file per topic next to it (`pet.js`, `books.js`, `reminders.js`, ...). Data model: `server/prisma/schema.prisma`.
- `scripts/` start, stop, backups, demo, sharing and the database opener.
