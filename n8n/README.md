# n8n → LinkedIn

1. Start n8n (`npx n8n`, opens at http://localhost:5678).
2. **Workflows → Import from file →** `linkedin-post.workflow.json`.
3. Open the **LinkedIn** node → create credential (n8n walks you through the LinkedIn OAuth; you need a LinkedIn developer app with the "Share on LinkedIn" product enabled). Select your person profile.
4. Toggle the workflow **Active**.
5. Open the **Webhook** node, copy the **Production URL** (looks like `http://localhost:5678/webhook/thought-studio-post`).
6. Paste it into `apps/api/.env` as `N8N_WEBHOOK_URL=...` and restart `npm run dev`.

The app sends `{ "postId": 1, "text": "..." }`; the LinkedIn node posts `text` as you.
Until this is set up, the POST button copies your draft and opens LinkedIn instead.
