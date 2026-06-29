# Deploying Company Brain to Render

Two always-on services (Next.js **web** + pg-boss **worker**) on Render, with
**Neon** Postgres (pgvector) as the DB. The repo is container-ready
(`Dockerfile.web`, `Dockerfile.worker`) and `render.yaml` wires both services +
a shared env group. Total: ~$14/mo Render + Neon (free→~$10–20) + domain (~$1).

## 1. Push the repo to GitHub
The repo is already committed locally on `main`. Create an **empty private repo**
on github.com (no README/license), then:

```bash
cd "C:/Users/youso/Claude Code/company-brain"
git remote add origin https://github.com/<you>/company-brain.git
git push -u origin main
```
(`.env` and `github-app.private-key.pem` are gitignored — they will NOT be pushed.)

## 2. Provision the production database (Neon)
- You can reuse the existing Neon project, or create a fresh one for prod.
- Copy its connection string (`...?sslmode=require`) — that's `DATABASE_URL`.
- Apply migrations once from your machine:
  ```bash
  DATABASE_URL="<neon-url>" pnpm --filter @company-brain/db migrate
  ```

## 3. Create the Render services (Blueprint)
- Render dashboard → **New → Blueprint** → pick the GitHub repo → it reads
  `render.yaml` and creates `company-brain-web`, `company-brain-worker`, and the
  `company-brain` env group.
- **Apply**, then open the env group and set every secret (`sync:false`):

| Var | Value |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `GEMINI_API_KEY` | your Gemini key |
| `GITHUB_APP_ID` | from the GitHub App settings |
| `GITHUB_APP_PRIVATE_KEY` | the PEM, with literal `\n` for newlines (or paste multi-line) |
| `GITHUB_WEBHOOK_SECRET` | the App's webhook secret |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | the App's OAuth creds |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` (32 bytes) |

Non-secrets (provider, models, cron, etc.) are already baked into `render.yaml`.

## 4. Set the public-URL vars
After the first deploy, the web service has a URL like
`https://company-brain-web.onrender.com`. Set on the **web** service:
- `NEXTAUTH_URL` = that URL
- `APP_BASE_URL` = that URL

(Redeploy the web service so they take effect.)

## 5. Point the GitHub App at the deployment
In the GitHub App settings (github.com/settings/apps/<your-app>):
- **Webhook URL** → `https://company-brain-web.onrender.com/api/github/webhooks`
- **Callback URL** (OAuth) → `https://company-brain-web.onrender.com/api/auth/callback/github`
- Confirm the **Webhook secret** matches `GITHUB_WEBHOOK_SECRET`.

This replaces the dev smee tunnel — PR checks and `/brain dismiss` now fire
automatically via GitHub → Render, no localhost.

## 6. Verify
- `https://…onrender.com/api/health` → `{ ok: true }`.
- Sign in with GitHub on the dashboard.
- Open a test PR → Company Brain comments; reply `/brain dismiss` → the warning
  resolves (check the worker logs in Render).

## 7. (Optional) Custom domain
Web service → **Settings → Custom Domains** → add your domain → set the CNAME at
your registrar (TLS is automatic). Then update `NEXTAUTH_URL`, `APP_BASE_URL`,
and the two GitHub App URLs to the custom domain.

## Notes
- Keep **both** services on the Starter plan: the worker must stay up for the
  queue + rescan/refresh cron, and the web receives webhooks where a free-tier
  cold start would blow the <2s ack and trigger GitHub redeliveries.
- `ALLOWLIST_REPOS` is empty in `render.yaml` (unrestricted). Set it to a
  comma-separated list to scope which repos the bot may comment on.
