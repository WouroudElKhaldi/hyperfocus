# n8n workflows (optional)

Hyperfocus fetches its job sources by itself (the `radar-fetch` background job). These workflows are **optional**: use
them if you would rather run the fetching in your own n8n (for example to add sources the app has no adapter for, or
to keep the schedule in one place). Both are free; see `docs/hosting-n8n.md` for running n8n on the same server.

| File | What it does |
|---|---|
| `job-radar-ingest.workflow.json` | Every 2 hours: for each source, fetches its pages (following "next page", at most 10, retried 3 times), makes one batch per page (at most 500 postings), signs it, and sends it to `POST /api/ingest/jobs` (retried 4 times, 30 s apart). |
| `job-radar-error.workflow.json` | When the ingest fails: a push alert to your phone through [ntfy](https://ntfy.sh) (free). |

## Set up

1. On the Hyperfocus server, set `INGEST_SECRET` in `.env` (make one with `pnpm secrets:new-key`) and restart it.
2. In n8n's environment (its `docker-compose.yml` or service file) set:
   - `HYPERFOCUS_URL`: the app's address, e.g. `https://hyperfocus.example.com`
   - `HYPERFOCUS_INGEST_SECRET`: the same value as `INGEST_SECRET`
   - `ALERT_URL`: `https://ntfy.sh/<a long random topic>` (and subscribe to that topic in the ntfy app)
   - `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`, so the workflows can read these three values
3. In n8n: **Workflows → Import from file**, import both files.
4. Open the ingest workflow → **Settings → Error workflow** → pick "Hyperfocus · Job Radar alert". Save, then switch the
   ingest workflow **Active**.
5. To add a source: in the **Sources** node add a line (two examples are there, commented out). The source key
   (`greenhouse:gitlab`) must also exist in Hyperfocus (Admin → Job sources), or the batch is refused with 400.

## How the signature works

`X-Signature: sha256=<hex HMAC-SHA256 of "<X-Timestamp>.<body>">` with the shared secret. The timestamp must be
within 5 minutes of the server's clock, and `X-Idempotency-Key` names the batch: sending the same batch again changes
nothing. Anything that can do this can deliver postings; n8n is one way.

Checked: both files are valid JSON whose connections point at real nodes and whose code nodes parse
(`apps/api/test/unit/n8n-workflow.test.js`). Not yet imported into a running n8n.
