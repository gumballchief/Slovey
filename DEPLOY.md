# Deploying Company Brain to Render

Two always-on services — Next.js **web** + pg-boss **worker** — on Render, with
**Supabase** providing Postgres (pgvector), Auth, and storage. The repo is
container-ready (`Dockerfile.web`, `Dockerfile.worker`) and `render.yaml` wires
both services + a shared env group. Cost: ~$14/mo Render + Supabase (free tier
works to start) + domain (~$1).

> Auth is **Supabase Auth** (GitHub, Google, email). The GitHub *App* (webhooks,
> repo access, PR comments) is separate from the GitHub *OAuth provider* you
> configured inside Supabase — don't confuse the two.

## 1. Push the repo to GitHub
Already on `main` at `gumballchief/brain`. `.env` and `*.private-key.pem` are
gitignored — they are never pushed.

## 2. Database (Supabase)
- Reuse the existing Supabase project (or a fresh one for prod).
- `DATABASE_URL` = the **session pooler** string (port 5432, `?sslmode=require`).
- Apply migrations once from your machine (skip if the project is already
  migrated):
  ```bash
  DATABASE_URL="<supabase-pooler-url>" pnpm --filter @company-brain/db migrate
  ```

## 3. Create the Render services (Blueprint)
- Render → **New → Blueprint** → pick `gumballchief/brain` → it reads
  `render.yaml` and creates `company-brain-web`, `company-brain-worker`, and the
  `company-brain` env group.
- **Apply**, then open the env group and set every secret (`sync:false`):

| Var | Value |
|---|---|
| `DATABASE_URL` | Supabase session-pooler string (`?sslmode=require`) |
| `DATABASE_URL_POOLED` | Optional: transaction-pooler string (same host, port **6543**). App query pools prefer it — no 15-session cap, so web instances can scale horizontally. pg-boss + migrations always use `DATABASE_URL`. **Before enabling:** in Supabase raise the transaction pooler's pool size and check the role's `statement_timeout` — with the defaults, queries that queue under load get killed with `57014 statement timeout` (verified under a 300-user test). Enable only after a load run passes. |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://krrtszbhekhthsgpooat.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key (public by design) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (**secret**, server-only) |
| `GEMINI_API_KEY` | your Gemini key |
| `GITHUB_APP_ID` | from the GitHub App settings |
| `GITHUB_APP_PRIVATE_KEY` | the PEM, with literal `\n` for newlines |
| `GITHUB_WEBHOOK_SECRET` | the App's webhook secret |
| `TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` (32 bytes) |

> **⚠️ Gotcha — the GitHub App's Webhook URL must be exactly `https://slovey.dev/api/github/webhooks`.**
> It was once typo'd to `slovey.**com**` (a domain we don't own). Nothing surfaced this: GitHub
> reported every install as successful, while each delivery silently died with
> `remote error: tls: handshake failure` (500). With no `installation` event ever
> arriving, the `installations` table stayed empty, `linkUserMemberships()` had no
> installation id to match, and **every** user's repos were invisible — which looks
> exactly like a login/identity bug and will send you chasing auth for hours.
> Verify with the App's own credentials, not the UI:
> `GET /app/hook/config` (the live URL) and `GET /app/hook/deliveries` (status per event —
> `202` good, `401` = webhook-secret mismatch, `500`/tls = URL wrong/unreachable).
> Replay a missed install with `POST /app/hook/deliveries/{id}/attempts` — never replay an
> `installation.deleted`. Note: delivery ids exceed `Number.MAX_SAFE_INTEGER`, so `JSON.parse`
> rounds them and the replay 404s; quote them (`"id":\s*(\d{16,})` → string) before parsing.

Non-secrets (provider, models, cron) are baked into `render.yaml`. The
`NEXT_PUBLIC_*` values are inlined into the client bundle at build time —
`Dockerfile.web` declares them as build args so Render passes them through.

## 4. Set the public-URL vars
After the first deploy, the web service has a URL like
`https://company-brain-web.onrender.com`. On the **web** service set:
- `APP_BASE_URL` = that URL (redeploy the web service so it takes effect).

Then in **Supabase → Authentication → URL Configuration**:
- **Site URL** = the same URL.
- **Redirect URLs** → add `https://company-brain-web.onrender.com/auth/callback`.

(GitHub/Google OAuth callbacks point at Supabase's fixed
`https://<ref>.supabase.co/auth/v1/callback` and do **not** change per deploy.)

## 5. Point the GitHub App at the deployment
In the GitHub App settings (github.com/settings/apps/slovey-dev):
- **Webhook URL** → `https://company-brain-web.onrender.com/api/github/webhooks`
  (this replaces the dev smee tunnel).
- Confirm the **Webhook secret** matches `GITHUB_WEBHOOK_SECRET`.
- Ensure **Pull requests** is subscribed under events.

## 6. Verify
- `https://…onrender.com/api/health` → `{ status: "ok", db: "ok" }`.
- Sign in on the dashboard (GitHub / Google / email).
- Open a PR on an allowlisted repo → Company Brain comments; the same result
  appears under `/pull-requests`. Reply `/brain dismiss` → the warning resolves
  (watch the worker logs in Render).

## 7. (Optional) Custom domain
Web service → **Settings → Custom Domains** → add your domain → set the CNAME
(TLS is automatic). Then update `APP_BASE_URL`, the Supabase Site URL/redirects,
and the GitHub App webhook URL to the custom domain.

## Notes
- Keep **both** services on Starter: the worker must stay up for the queue +
  rescan/refresh cron, and the web receives webhooks where a free-tier cold start
  would blow the <2s ack and trigger GitHub redeliveries.
- `ALLOWLIST_REPOS` is empty in `render.yaml` (unrestricted). Set a
  comma-separated list to scope which repos the bot may comment on.
- The worker connects to Supabase's pooler with non-verifying TLS (the pooler
  cert isn't in Node's default trust store) — handled in `queue/index.ts`.
