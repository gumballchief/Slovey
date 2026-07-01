# Feature spec: Auto-open-a-PR agent

**Status:** proposed / next-phase
**One-liner:** Describe a change on the website → Company Brain drafts the code as a
branch, opens a **draft PR**, and then **reviews its own PR against your team's
memory** before handing it to a human.

---

## 1. Why this is a natural fit (not a pivot)

Company Brain already owns the two *hard* halves of an agentic coding loop:

- **Context/memory** — `retrieveDecisions()` (embeddings over approved+proposed
  decisions), plus `repo_knowledge` (architecture, dependency graph, conventions)
  from `index-repo`. It knows *how this team builds*.
- **A reviewer/judge** — `checkPr()` already evaluates whether a diff conflicts
  with memory and posts a cited verdict (we just watched it flag raw-SQL vs the
  Drizzle decision).

The only missing piece is the **author** in the middle: take an intent + that
context, generate a patch, and open a PR. And because the agent's output is just
*another PR*, it flows straight back through the **existing** `checkPr` guardrail.

> **The moat:** most coding agents write code blind to a team's decisions. This
> agent writes code that is *constrained by the same memory that reviews it* —
> and then proves it by self-reviewing. "Consistent by construction."

This reframes the product from **memory that reviews** → **memory that acts**.

---

## 2. What exists vs. what's net-new

| Capability | Status | Where |
|---|---|---|
| Per-installation GitHub auth | ✅ reuse | `github/app.ts` `getInstallationOctokit()` |
| Read repo files (tree/blob) | ✅ reuse | `github/index.ts` `fetchDocs`, `fetchPrForCheck` |
| Post PR comments | ✅ reuse | `postOrUpdateComment` |
| Retrieve decisions/memory | ✅ reuse | `pipelines/retrieve.ts` |
| Repo knowledge / architecture | ✅ reuse | `repo_knowledge`, `index-repo.ts` |
| Auto-review a PR vs memory | ✅ reuse | `pipelines/check.ts` `checkPr()` |
| AI provider + premium model | ✅ reuse | `getChat()` / `AI_PROVIDER`, `premiumModel` |
| pg-boss job + worker handler | ✅ pattern | `queue/jobs.ts`, `apps/worker/src/index.ts` |
| **Write a branch/commit/PR** | ❌ **new** | `pulls.create`, `git.createRef/Tree/Commit` |
| **Code-gen pipeline** | ❌ **new** | `pipelines/agent.ts` (new) |
| **`agent_runs` table + task API** | ❌ **new** | `schema.ts`, `api/repos/[id]/tasks` |
| **Task UI (new-task + run detail)** | ❌ **new** | `app/app/tasks/*` |
| **GitHub App `contents:write`** | ❌ **new** | App settings (permission escalation) |

---

## 3. User flow (website-native)

1. **New task** (`/app/tasks/new`): pick repo, type intent
   (*"add rate limiting to the login endpoint"*), optionally point at an area/files.
2. Agent runs (progress streams to the run page):
   **plan → gather context → generate patch → open draft PR → self-review**.
3. **Run detail** (`/app/tasks/:id`) shows: the plan, the diff, the PR link, and
   the memory-check verdict — the same verdict that also appears under
   `/pull-requests` and as a comment on the PR itself.
4. Human reviews the draft PR and merges. **The agent never merges.**

---

## 4. The agent loop

```
intent ─▶ PLAN ─▶ GATHER CONTEXT ─▶ GENERATE PATCH ─▶ BRANCH+COMMIT ─▶ DRAFT PR
                    │                                                      │
          retrieveDecisions(intent)                                 checkPr(PR)  ◀── existing guardrail
          + repo_knowledge (arch/graph)                                   │
          + relevant file contents                             verdict == conflict?
                                                                 │yes         │no
                                                          revise (≤N)     ready for human
```

- **Plan** — LLM proposes steps + the files likely to change. Prompt includes
  `repo_knowledge` (architecture, dependency graph) and the top decisions from
  `retrieveDecisions(intent)` so the plan respects conventions up front.
- **Gather context** — fetch the planned files' contents (reuse `git.getBlob`),
  plus dependency-graph neighbors.
- **Generate patch** — the `premiumModel` (strongest available; e.g. Claude Opus)
  emits concrete file edits, **constrained to the planned files**, with the
  retrieved decisions injected as **hard constraints** ("MUST use Drizzle; tests
  in Vitest").
- **Branch + commit** — create a branch off the default branch and commit the
  edits via the Git Data API. **Never** writes to `main`/default.
- **Draft PR** — open a *draft* PR whose body cites the intent, the plan, and
  which decisions it honored.
- **Self-review** — `checkPr` runs automatically on the new PR (it's a PR event).
  If `verdict == conflict`, the agent reads its own warning and revises (loop up
  to N times) **before** marking the run "ready for human." This is the product
  dogfooding its own guardrail.

---

## 5. Data model (`agent_runs`)

```
id            uuid pk
repo_id       uuid → repos
intent        text                 -- the user's request
status        enum(queued|planning|coding|opening_pr|reviewing|revising|ready|failed|cancelled)
plan          jsonb                -- steps + target files
files_changed text[]               -- paths the patch touched
pr_number     integer
pr_url        text
check_id      uuid → pr_checks     -- the self-review result
iterations    integer default 0
cost_tokens   integer
requested_by  text                 -- which user
error         text
steps         jsonb                -- full audit log (prompts, diffs, verdicts)
created_at / updated_at
```

Everything is logged for audit — every prompt, diff, and verdict is inspectable.

---

## 6. Safety & guardrails (this is a code-writing agent — non-negotiable)

- **Draft PRs only.** Agent never merges, never pushes to `main`/default.
- **Repo allowlist.** Reuse `ALLOWLIST_REPOS`; the agent acts only on repos the
  user has explicitly opted in.
- **Human gate.** A run's PR is a draft assigned to the requester; nothing ships
  without a human clicking merge.
- **Memory as constraint *and* gate.** Decisions are injected into the codegen
  prompt **and** re-verified by `checkPr` afterward — belt and suspenders.
- **Path deny-list.** MVP refuses to touch `.github/workflows/*`, `.env*`,
  `**/migrations/*`, lockfiles, and anything under `packages/db/src/schema.ts`
  (schema/CI/secrets changes need a human author).
- **Scope ceilings.** Max files, max LLM calls, max revise-iterations, per-run
  token budget. Exceed → abort and surface the partial run.
- **Provenance.** PR is clearly labeled *"opened by Company Brain agent on behalf
  of @user"*.
- **Permission escalation is real.** `contents:write` is a meaningful jump from
  today's comment-only App. Options: (a) add it to the existing App with a clear
  consent screen, or (b) ship a **separate opt-in "Company Brain Agent" App** so
  read-only reviewing and code-writing are different trust decisions. Recommend
  (b) for launch.

---

## 7. Phasing

- **Phase 0 — write path.** `agent_runs` table, `agentTask` job, Git Data API
  helpers (`createBranch`, `commitFiles`, `openDraftPR`), permission bump. Proof:
  programmatically open a trivial PR end-to-end.
- **Phase 1 — MVP.** Single-file changes from a text intent, memory-constrained
  codegen, draft PR, auto self-review (no revise loop yet), path deny-list.
  Website: new-task form + run detail page.
- **Phase 2 — iterate.** Multi-file changes, dependency-graph-aware context, the
  revise-until-clean loop (≤N), streaming progress, read the repo's own CI result.
- **Phase 3 — proactive.** Agent proposes tasks *from memory-health*: e.g.
  "3 endpoints still use raw SQL, migrate them to Drizzle?" → one click → PR.
  This is where memory + action compound.

---

## 8. Open questions / risks

- **Model choice.** Codegen wants the strongest model (Opus-class), which may
  differ from the cheap judge model. `getChat()` already exposes `premiumModel`;
  may want a dedicated `AGENT_MODEL`.
- **Cost.** Codegen over large files is expensive → hard token ceilings + small
  MVP scope.
- **Correctness.** Mitigated by small scope + self-review + human gate + the
  repo's own CI on the PR (Phase 2 reads CI status).
- **Stale base / conflicts.** Branch off latest default; handle rebase on failure.
- **Test execution.** MVP leans on the repo's existing CI (the PR triggers it);
  the agent doesn't run tests itself until Phase 2.

---

## 9. TL;DR

The review loop is already live. This feature adds the **author**: a memory-
constrained code-gen step that opens a **draft PR**, which the **existing**
guardrail then reviews. Small, safe, phased — and it turns "Company Brain warns
you" into "Company Brain fixes it, consistently with what your team already
decided."
