# Your own n8n on the same server as Hyperfocus (free)

For **you only** (the website's owner): your scheduled LinkedIn posts go through your own n8n, which runs on the same
server as the website. Nothing to buy, nothing exposed to the internet. Everyone else posts with their own LinkedIn app
(Settings → Your connections), or their own n8n.

You may not need this at all: **Connect LinkedIn** with your own free LinkedIn app posts directly, without n8n (guide
in the app: Settings → Your connections → "How do I get this?").

## How it fits

```
internet ──https──> Caddy ──> Hyperfocus (API + website)
                                   │  your posts only (N8N_WEBHOOK_URL)
                                   ▼
                     n8n on 127.0.0.1:5678  (not reachable from the internet)
you ──ssh tunnel──> n8n's editor, from your laptop
```

- n8n listens on `127.0.0.1` only: nobody on the internet can open it.
- Hyperfocus reaches it at `http://127.0.0.1:5678/webhook/…`, set by you in `.env` as `N8N_WEBHOOK_URL`. The app uses
  this address **only for your posts** (local mode, or the emails in `ADMIN_EMAILS`); other people's posts never go
  there, and nobody else can save an address on the server or a private network.
- You open n8n's editor through an SSH tunnel from your laptop (free, encrypted, nothing to open on the server).

## Steps (on the server; the commands are for Ubuntu, which Oracle's free server runs)

1. **Install n8n** (Node.js is already there for Hyperfocus):
   ```
   sudo npm install -g n8n
   ```
2. **Give it its own database** in the same PostgreSQL, so it's backed up with everything else:
   ```
   sudo -u postgres psql -c "CREATE USER n8n PASSWORD 'choose-a-long-password';"
   sudo -u postgres psql -c "CREATE DATABASE n8n OWNER n8n;"
   ```
3. **Run it as a service** that starts by itself and listens only on the server. Create
   `/etc/systemd/system/n8n.service`:
   ```
   [Unit]
   Description=n8n (owner only, local)
   After=network.target postgresql.service

   [Service]
   User=hyperfocus
   Environment=N8N_LISTEN_ADDRESS=127.0.0.1
   Environment=N8N_PORT=5678
   Environment=N8N_HOST=localhost
   Environment=N8N_PROTOCOL=http
   Environment=WEBHOOK_URL=http://127.0.0.1:5678/
   Environment=DB_TYPE=postgresdb
   Environment=DB_POSTGRESDB_HOST=127.0.0.1
   Environment=DB_POSTGRESDB_DATABASE=n8n
   Environment=DB_POSTGRESDB_USER=n8n
   Environment=DB_POSTGRESDB_PASSWORD=choose-a-long-password
   Environment=N8N_DIAGNOSTICS_ENABLED=false
   ExecStart=/usr/bin/env n8n start
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```
   Then: `sudo systemctl daemon-reload && sudo systemctl enable --now n8n`
4. **Open the editor from your laptop** (Windows PowerShell):
   ```
   ssh -L 5678:127.0.0.1:5678 ubuntu@your-server
   ```
   Keep that window open and go to http://localhost:5678 on your laptop. The first time, create n8n's owner account.
5. **Build the workflow** exactly as in the in-app guide (section 4: Webhook (POST) → LinkedIn "Create a post", Text =
   `{{ $json.body.text }}`), switch it on, and copy the **Production URL**. It starts with `http://127.0.0.1:5678/webhook/`.
6. **Tell Hyperfocus** in the server's `.env`: `N8N_WEBHOOK_URL=http://127.0.0.1:5678/webhook/…` and restart the API.
   Your posts (now and scheduled) go to your n8n; check them in n8n's **Executions**.

## Memory

n8n uses about 300–500 MB. On Oracle's free 4-core / 24 GB server that's nothing; on a 1 GB server it's tight with
PostgreSQL and Hyperfocus also running.

## Licence

n8n is free to run yourself under its Sustainable Use License (personal and internal use). Only n8n's hosted cloud is
paid, and you don't use it.

## Optional: fetch job postings with n8n

The app fetches its job sources by itself. If you would rather do it in your n8n, import the two workflows in
`integrations/n8n/` (their README shows the four settings to add).
