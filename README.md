# Slovey

**Engineering memory for teams and AI agents.** Slovey learns a team's decisions
from GitHub history and warns on pull requests that conflict with them — always
citing the specific decision and the PR it came from.

### 🌐 [slovey.dev](https://slovey.dev)

- **GitHub App** — install it and PRs get checked automatically, no local setup.
- **Preflight gate** — a pre-commit / pre-PR check that blocks changes which
  contradict a recorded decision, so your coding agent can't relitigate settled calls.
- **Ask Slovey** — ask "why is it done this way?" and get an answer grounded in the
  actual decision graph, with citations.
- **MCP server** — expose the memory to any MCP-compatible agent.

**Getting started as a user?** See **[docs/quickstart.md](./docs/quickstart.md)** —
install the GitHub App or wire the Preflight gate into your coding agent.

Building on it? **[BACKEND.md](./BACKEND.md)** has the architecture decisions and roadmap.

---

> This repo is the full monorepo behind the product at **[slovey.dev](https://slovey.dev)**.
> (Package identifiers are still prefixed `@company-brain/*`, the project's original codename.)

## Layout

```
apps/
  web/      # Next.js dashboard (the marketing site + app UI)
  worker/   # pg-boss consumer (extract & check jobs) + seed + eval scripts
packages/
  config/   # zod env validation + shared types
  db/       # Drizzle schema, generated migrations, client (Postgres + pgvector)
  core/     # product logic: ai/ embeddings/ github/ pipelines/ guardrails/ queue/ services/
```

## Prerequisites

- Node 20+ and **pnpm** (`npm i -g pnpm`)
- **Postgres with pgvector**. Easiest: `docker compose up -d` (uses `pgvector/pgvector:pg16`).
- Anthropic + Voyage API keys; a registered GitHub App (for live runs).

## Setup

```bash
pnpm install
cp .env.example .env          # then fill in secrets

# Database (with Docker)
docker compose up -d
pnpm db:generate              # generate SQL from the schema (already committed)
pnpm db:migrate               # enables pgvector + applies migrations

# Seed the proven prototype memory for the test repo (needs an embeddings key)
pnpm seed

# Run
pnpm dev:web                  # dashboard on :3000
pnpm dev:worker               # job consumer
```

### Local webhooks

Expose the webhook endpoint with smee or ngrok and point the GitHub App's webhook
URL at it:

```bash
npx smee-client --url https://smee.io/<your-channel> --target http://localhost:3000/api/github/webhooks
```

The webhook route verifies the signature, enqueues a job via pg-boss, and returns
202 in <2s. The worker does the heavy lifting.

## Scripts

| Command | What |
|---|---|
| `pnpm typecheck` | Type-check every package |
| `pnpm test` | Unit tests (citation guardrail, confidence floor, dedupe, webhook parsing) |
| `pnpm db:generate` / `db:migrate` / `db:studio` | Drizzle migrations / studio |
| `pnpm seed` | Load the prototype's `brain.json` decisions for `gumballchief/pr-bot-test` |
| `pnpm eval` | Run the eval harness (precision/recall/FP-rate per threshold) |
| `pnpm check` | Preflight: DB + pgvector + AI chat + embeddings connectivity |
| `pnpm --filter @company-brain/worker sync` | Sync installations/orgs/repos from GitHub |
| `pnpm --filter @company-brain/worker index-repo` | Index a repo's architecture into `repo_knowledge` |
| `pnpm --filter @company-brain/worker check-pr <n>` | Manually run the check pipeline on a PR |

## Operations & hardening

- **Health**: `GET /api/health` pings the DB (used for liveness/readiness probes).
- **Logging**: structured JSON via `packages/core/src/logger.ts` (`logger.child({ component })`), level set by `LOG_LEVEL`, secret fields auto-redacted.
- **Job durability**: pg-boss jobs retry (3×, backoff) and expire — see `enqueue()` defaults in `packages/core/src/queue`.
- **Rate limiting**: in-memory limiter (`apps/web/lib/server/ratelimit.ts`) on the webhook (flood) and AI-costly routes (rebuild, search). Swap the store for Postgres/Redis for multi-instance.
- **AuthZ / multi-tenancy**: every installation maps to an `organization`; `assertRepoAccess`/`assertRepoWrite` authorize via owner-match or org membership (role-gated writes). Memberships populate from GitHub on OAuth login.
- **Audit log**: `logAudit()` writes immutable, org-scoped rows for installs, checks, decision edits, settings, rebuilds, and feedback.
- **CI / Docker**: `.github/workflows/ci.yml` (typecheck + test + migration-drift check); `Dockerfile.web` + `Dockerfile.worker`.

## Integration seams (where real systems plug in)

- **`packages/core/ai`** — swap the model/provider (Anthropic default; router picks cheap vs premium).
- **`packages/core/embeddings`** — Voyage (default) or OpenAI, behind one interface.
- **`packages/db/schema.ts`** — the single source of truth; `repo_knowledge` is the Phase-4 graph seam.
- **Layer 3/4 connectors** — stubbed; no real Linear/Jira/Notion/Slack OAuth yet.

## Safety rails (enforced in code)

Citation-or-silence, confidence floor, no-double-comment dedupe, per-repo isolation,
and an `ALLOWLIST_REPOS` env that prevents the bot from commenting anywhere except the
test repo during development. See `packages/core/src/guardrails` and `pipelines/check.ts`.
