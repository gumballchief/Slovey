# Company Brain — Backend Architecture & Decisions

> Acting as CTO/lead architect. This document reconciles the two backend briefs,
> records the binding decisions, and lays out the build. Read this before the code.

## 0. The two briefs conflict — here is how they're resolved

The two prompts agree on the **product** (an engineering-memory AI that judges PRs
against a company's own decisions, always with evidence, quiet by default) but
disagree on **stack and process**. Conflicts resolved decisively:

| Axis | Brief A (prototype-grounded) | Brief B (visionary CTO) | **Decision & why** |
|---|---|---|---|
| Language | TypeScript / Node 20+ | FastAPI/Python **or** NestJS | **TypeScript / Node.** The working prototype is `.mjs`, the frontend is TS. One language = the proven judge logic ports verbatim and types flow end-to-end. (Brief B sanctions TS via "NestJS if better".) |
| ORM/DB | Postgres + pgvector + Drizzle | Postgres + Redis + pgvector, SQLAlchemy/Prisma | **Postgres + pgvector + Drizzle.** Drizzle is Brief A's explicit pick and is the cleanest TS option. |
| Queue | pg-boss (Postgres) | Redis | **pg-boss.** One datastore, no Redis to operate. Redis stays an optional later seam for caching/rate-limit. |
| Auth | Auth.js (GitHub OAuth) | Clerk **or** Auth.js | **Auth.js** — satisfies both. |
| AI model | `claude-sonnet-4-6`, hardcoded in prototype | provider abstraction + cheap/premium routing | **Both:** `claude-sonnet-4-6` is the default, but behind an `AIProvider` interface with a **router** (cheap model for classify/extract-batch, premium for the judge). Gets Brief A's proven behavior + Brief B's flexibility. |
| Embeddings | Voyage `voyage-3` (OpenAI alt) | (unspecified) | **Voyage `voyage-3` (1024-dim)** behind an `EmbeddingProvider` interface, OpenAI `text-embedding-3-large@1024` as the swappable alt. |
| Process | build in stages, report each | design-first, get approval | **Hybrid:** this doc is the design; then build in Brief A's staged order (you said "build"). |

## 1. Improvements / weaknesses / missing features (Brief B's "First Task")

**Weaknesses in the briefs I'm correcting:**
- *Death by false positive.* The whole product dies if it cries wolf. Enforced in **code**, not prompts: citation guardrail (no resolved citation → no comment), a confidence floor, and an **eval harness** that reports precision/recall/FP-rate per threshold so we tune toward ~zero FPs.
- *Retrieval blindness.* The prototype dumps all decisions at the judge — won't scale past a few dozen. Fixed with **categorize → embed → pgvector top-K** retrieval.
- *Idempotency.* Webhooks redeliver and PRs re-sync. Every check is keyed by `(repo_id, pr_number, head_sha)`; comments are updated, never stacked.
- *Tenant isolation.* Every query is scoped by `repo_id` and authorized against the caller. Non-negotiable before private sources (Slack) land.

**Missing features I'm adding as schema/seams (from Brief B):**
- Organizations, memberships + **RBAC** (owner/admin/member/viewer), and **audit_logs**.
- **AIProvider** abstraction + model routing (not one hardcoded model).
- **Semantic knowledge search** endpoint (pgvector already powers it).
- **Repo knowledge** seam (`repo_knowledge` jsonb) for the future architecture/dependency-graph parser — Phase 4, stubbed now so the schema doesn't churn later.

**Explicitly out of scope (clean stubs, not built):** real Layer-3 connector OAuth (Linear/Jira/Notion), Layer-4 (Slack/Discord/meetings), billing, the full repo parser/AST graph.

## 2. Non-negotiable guardrails (enforced in code)

1. **Citation or silence.** A warning with no decision+PR/doc citation that resolves against the DB is never posted. Hard check in `pipelines/check.ts`.
2. **No invented decisions.** Any extracted decision with empty evidence is dropped.
3. **Quiet by default.** Comment only at/above the repo's confidence threshold (default `high`).
4. **Ownership/installation check on every action.** Never comment on a repo the app isn't installed on / the user doesn't own.
5. **Never double-comment.** Dedup on `(repo_id, pr_number, head_sha)`; update or skip.
6. **Secrets in env only**, never logged/committed; stored tokens encrypted at rest.
7. **Strict per-repo isolation**, authorized against the requesting user.

## 3. Monorepo layout

```
apps/
  web/      # Next.js dashboard (exists) + /api route handlers + /api/github/webhooks (thin layer over core)
  worker/   # pg-boss consumer: extract & check jobs; seed + eval scripts
packages/
  config/   # zod env parsing + shared types
  db/       # drizzle schema, migrations, client (pgvector)
  core/     # product logic shared by web + worker:
            #   ai/         provider interface + anthropic/gemini/openai + router (judge/extract prompts)
            #   embeddings/ provider interface + voyage + openai
            #   github/     octokit app/installation clients, PR+discussion+doc fetchers, webhook verify
            #   pipelines/  extract, retrieve, check, consolidate, feedback
            #   guardrails/ citation enforcement, confidence floor
            #   eval/       harness + fixtures
```

Product logic lives in `core` (framework-agnostic, unit-testable). `web` and `worker`
are thin hosts. This is why the webhook handler is a 15-line route that calls
`core/github/webhooks` + enqueues — keeping the <2s ack hard requirement easy to hold.

## 4. Pipelines

1. **extract** — fetch closed PRs (merged+rejected) + discussion threads → LLM extract `{decision,why,examples,evidence,category}` → LLM consolidate + pgvector dedup → embed → upsert. Drops empty-evidence; won't wipe rich memory with an empty rebuild. Also ingests Layer-2 docs (`source='doc'`, path as citation).
2. **retrieve** — categorize the PR → query-embed (title+body+paths+diff summary) → pgvector top-K over `approved` decisions, category-boosted. Keeps the judge prompt small.
3. **check** — judge (ported prompt) → `{warn,confidence,evidence,explanation}` → confidence floor → **citation guardrail** → dedup → post/update one comment, **or** a GitHub commit status (`status_check` mode: `pending` at start → `success` on clear / `failure` on conflict, so it works as a required merge gate). Down-weights team-dismissed decisions when `learn_from_dismissals` is on.
4. **feedback** — dashboard dismiss, `/brain dismiss` command, or 👎 reaction → record → feed back into retrieval/judging. (GitHub has no comment-reaction webhook, so 👎 reactions are polled during the rescan sweep and folded into dismissals, deduped per check+user.) A dismissed decision is **hard-suppressed**: the check won't re-warn about it even if the judge would (the soft prompt-negative can be overridden by a strong conflict, so this makes `/brain dismiss` stick), and a previously-posted warning is rewritten to a "✅ Resolved" note so nothing stale lingers on the PR.
5. **rescan** (scheduled) — pg-boss cron sweeps. `rescan_prs` (default every 6h) re-checks every open PR across active repos so warnings stay current as decisions/dismissals drift between pushes; `refresh_memory` (default daily 03:00 UTC) re-runs **extract** per repo to fold in newly merged history. Both fan out by enqueuing the existing `check_pr`/`extract` jobs (idempotent, allowlist-scoped). Cadence via `RESCAN_CRON`/`REFRESH_CRON`; trigger manually with `tsx src/rescan.ts [repoId]`.

## 5. Build order (status tracked here)

1. Scaffold monorepo, `packages/db` schema+migrations, env validation, GitHub App auth + webhook ingestion. ← **in progress**
2. Extract pipeline + embeddings + storage; verify it populates `decisions` and dedupes.
3. Categorize + retrieve + check; single cited comment, confidence floor, recorded check.
4. Wire dashboard API to real data (response shapes match the frontend's `Decision`/`CheckedPR`).
5. Settings + feedback/dismiss loop + `synchronize` re-checks (no double-comment).
6. Eval harness + threshold tuning.

## 6. Local-environment note

This machine has Node + npm + pnpm + git, but **no Postgres and no Docker**. All code,
the full schema, and generated SQL migrations are committed and type-check clean. To
run the DB-backed stages, start Postgres+pgvector via the provided `docker-compose.yml`
(or any pgvector-enabled Postgres) and follow the README. Live runs against
`gumballchief/pr-bot-test` happen once a database + GitHub App credentials are present.
