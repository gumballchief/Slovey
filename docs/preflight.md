# Preflight — AI supervising AI

Preflight is the guardrail between AI-generated code and your repository. An AI
coding agent runs it **after writing code and before committing** (and again
before pushing): it runs the project's real checks, checks the diff against the
Engineering Decision Graph and your architecture rules, and returns **exact,
agent-directed fix instructions**. The agent fixes, re-runs, and repeats until
`safeToCommit: true` — or Preflight tells it to stop and ask a human.

```
agent writes code → preflight_run → checks + decisions + architecture
   → fail? exact fixInstructions → agent fixes → preflight_run → …
   → pass → "safe to commit" | max attempts → "human review required"
```

It also works **before** coding: `mode: "planning"` returns the decisions and
rules that govern the repo, so the agent doesn't reintroduce something the team
already rejected.

## Setup — Claude Code (MCP)

`.mcp.json` in the repo (or your client's MCP config):

```json
{
  "mcpServers": {
    "company-brain": {
      "command": "npx",
      "args": ["-y", "tsx", "apps/mcp/src/index.ts"],
      "env": {
        "COMPANY_BRAIN_REPO": "owner/name",
        "COMPANY_BRAIN_REPO_PATH": "/absolute/path/to/repo"
      }
    }
  }
}
```

Add this to your agent's instructions (CLAUDE.md, Cursor rules, etc.):

> Before committing or completing any coding task, call Company Brain
> `preflight_run`. If `safeToCommit` is false, apply every `fixInstructions`
> item and run preflight again — pass the same `attemptId` across the loop. Do
> not commit until `safeToCommit` is true or `humanReviewRequired` is true (then
> stop and ask a human). Before starting non-trivial work, call `preflight_run`
> with `mode: "planning"`.

**Cursor / Windsurf / Codex / Gemini CLI / Aider / Continue.dev:** any
MCP-compatible client works the same way — register the same stdio server and
add the same instruction to the agent's rules file. Non-MCP agents can shell out
to the CLI (`companybrain preflight --json`) and read the identical JSON.

## MCP tools

| Tool | When | Returns |
|---|---|---|
| `preflight_run` | after coding, before commit/push; `mode:"planning"` before coding | the full result contract below |
| `preflight_validate_commit` | final gate right before committing (runs `mode:"commit"`) | verdict + `agentInstruction` |
| `preflight_fix_instructions` | to see what to change | prioritized fixes + decision violations |
| `preflight_status` | last result without re-running | pass/fail, safeToCommit/Push, attempt |
| `preflight_explain_failure` | understand a failure (`check` or `errorId`) | plain-language explanation |
| `preflight_list_checks` | discover what runs here | each check: kind, required, command, availability |
| `preflight_config` | inspect effective config | merged config + source |

## Modes

- **full** (default) / **push** — everything configured. Use before pushing.
- **quick** — static checks + typecheck/lint only (no test/build/decision-check). Seconds, not minutes.
- **commit** — quick + decision-check. What `preflight_validate_commit` and the pre-commit hook run.
- **changed-files** — full, with file-scoped checks limited to an explicit `changedFiles` list.
- **planning** — pre-code: no commands; returns `planning: { activeDecisions, rejectedApproaches, architectureRules, checksThatWillRun }`.

## Result contract (what the agent reads)

```jsonc
{
  "status": "pass" | "fail" | "partial" | "error", // partial = only optional checks failed
  "safeToCommit": true, "safeToPush": true, "humanReviewRequired": false,
  "summary": "…",
  "agentInstruction": "Agent, do not commit yet. Fix these issues first. …",
  "mode": "full",
  "attempt": { "attemptId": "…", "attemptNumber": 2, "maxAttempts": 5, "remainingAttempts": 3,
               "repeatedFailure": false, "unrelatedChangesDetected": false },
  "project": { "workspacePath": "…", "projectType": "node", "packageManager": "pnpm", "detectedScripts": ["typecheck","test","build"] },
  "checks": [{ "name": "typecheck", "status": "pass", "command": "pnpm typecheck", "blocking": true,
               "durationMs": 0, "errors": [], "stdoutSummary": "…", "stderrSummary": "…" }],
  "fixInstructions": [{ "id": "9212120e", "checkId": "typecheck", "priority": "high", "file": "…",
                        "problem": "…", "instructionForAgent": "Agent, fix this before continuing. …", "evidence": "…" }],
  "decisionViolations": [{ "decisionId": "…", "title": "…", "decisionStatus": "rejected", "violation": "…",
                           "instructionForAgent": "Agent, do not commit. This reintroduces a REJECTED approach…",
                           "confidence": 0.9, "evidence": ["ADR-17", "PR #296"] }],
  "warnings": ["You changed unrelated files. Focus only on the listed failures."],
  "nextSteps": ["Apply every fixInstructions item.", "Run preflight_run again."],
  "branch": "main", "commitSha": "…", "runId": "…", "createdAt": "…"
}
```

Errors carry a stable `id` (fingerprint) — pass it to
`preflight_explain_failure` / `companybrain preflight explain <id>`.

## The agent pipeline

Preflight is organized as an **AI-supervisor pipeline** — one specialized agent
per job, each owning its checks (`list_agents` MCP tool returns the roster):

```
Claude writes code
          │
          ▼
    Company Brain
          │
 ┌────────┼────────┐
 │        │        │
 ▼        ▼        ▼
Build   Security  Decision
Agent     Agent     Agent
 │        │        │
 └────────┼────────┘
          ▼
 Architecture Agent
          │
          ▼
  Performance Agent
          │
          ▼
    Testing Agent
          │
          ▼
    Context Agent
          │
          ▼
   Final Verdict      safeToCommit + agentInstruction
```

| Agent | Mission | Owns |
|---|---|---|
| **Build** | it must compile, lint, resolve | `typecheck` `lint` `build` `format` `deps` |
| **Security** | secrets, injection, authz, unsafe patterns | `secret-scan`, `security-review` (AI) |
| **Decision** | the Engineering Decision Graph — active + rejected | `decision-check` |
| **Architecture** | structural rules, config-defined + derived from rejected decisions | `architecture-check` |
| **Performance** | known footguns: sync calls in handlers, unawaited parallelism, wasteful patterns | `perf-check`, `perf` (script) |
| **Testing** | the test suite + runtime smoke | `test`, `smoke` |
| **Context** | route contracts, env-var contract, pre-code planning context | `env-check`, `route-check` |
| **Review** | post-PR: reviews every pull request against memory (checkPr) | — |

Every check result carries its owning `agent`, results are presented in pipeline
order (execution interleaves cheap checks first for latency), and the **Final
Verdict** aggregates all agents into `safeToCommit` + `agentInstruction`.

**`security-review`** is the Security Agent's AI pass — it reviews the diff for
what pattern-matching can't see: injection, missing authn/authz, unsafe
eval/deserialization, SSRF, path traversal, weak crypto. Optional by default,
runs in commit/full modes, low-confidence findings are dropped, and it skips
gracefully (never fails the gate) when the AI provider is down.

## Checks

- **Command-based** (auto-detected from `package.json` by package manager —
  pnpm/npm/yarn/bun — or overridden via config `commands`): `typecheck`, `lint`,
  `test`, `build`, `format`. Missing scripts are **skipped with a reason**; a
  skipped *required* check fails the gate unless `allowSkippedChecks`.
- **Static:** `secret-scan` (skips `.env.example`-style templates),
  `env-check`, `route-check`, `deps`.
- **`architecture-check`** — deterministic, rule-based (no LLM), against changed
  files only. Rules come from **config** and are **auto-derived from REJECTED
  decisions in the graph** (`architectureChecks.deriveFromDecisions`, default
  true): a whole-word reappearance of a rejected decision's distinctive term
  blocks even when the AI provider is down. Config rules:
  - `{ "type": "forbidden-import", "module": "ioredis", "in": "apps/web/**", "reason": "Redis was rejected — use CacheService." }`
  - `{ "type": "forbidden-content", "pattern": "db\\.query\\(", "in": "**/*.tsx", "flags": "i", "reason": "UI must not access the DB directly." }`
  - `{ "type": "forbidden-path", "glob": "legacy/**", "reason": "legacy/ was removed; do not reintroduce." }`
  - Trade-off: derived keyword rules can't tell code from comments — a comment
    mentioning the rejected tech will flag. Set `deriveFromDecisions: false` to
    rely solely on explicit rules + the AI decision-check.
- **`smoke`** — optional runtime smoke test: add a `smoke` / `test:smoke` /
  `healthcheck` script (boot the app or ping health, exit non-zero on failure)
  and Preflight runs it in full/push mode. Docker or a11y checks work the same
  way: point a script at them and add the command to `allowlistedCommands`.
- **`decision-check`** — the diff vs the Decision Graph: active constraints and
  **rejected/deprecated** approaches, with confidence. Only violations at/above
  `decisionChecks.minimumBlockingConfidence` (default 0.85) block; lower ones
  surface as warnings. AI judge with a conservative keyword fallback.

Example violation:
> Agent, do not commit. This reintroduces a REJECTED approach: "Redis was
> rejected in favor of CacheService" — the diff imports `ioredis` in
> `src/billing/cache.ts`. Replace it with the approved pattern, then run
> Preflight again.

## Configuration — `companybrain.preflight.json`

Generate a starter: `companybrain preflight init`

```json
{
  "requiredChecks": ["typecheck", "lint", "test", "build", "decision-check", "architecture-check"],
  "optionalChecks": ["secret-scan", "format", "env-check", "route-check", "deps"],
  "maxAttempts": 5,
  "blockCommitOnFailure": true,
  "blockPushOnFailure": true,
  "allowSkippedChecks": false,
  "timeoutMs": 120000,
  "commands": { "typecheck": "pnpm typecheck", "test": "pnpm test", "build": "pnpm build" },
  "allowlistedCommands": [],
  "decisionChecks": { "enabled": true, "blockOnHighConfidence": true, "minimumBlockingConfidence": 0.85 },
  "architectureChecks": { "enabled": true, "rules": [] },
  "secretScan": { "enabled": true }
}
```

## CLI

```
companybrain preflight                    full gate, human-readable
companybrain preflight --json             machine JSON (agents / CI)
companybrain preflight --fix-agent        agent-directed fixes only
companybrain preflight --mode quick       fast gate (also: commit|push|changed-files|planning)
companybrain preflight --check-only       skip decision-graph
companybrain preflight --max-attempts 5
companybrain preflight init               write starter config
companybrain preflight status             latest run, no re-run
companybrain preflight explain <errorId>  explain one stored error
companybrain preflight --install-hooks    pre-commit (mode: commit) + pre-push (full)
companybrain preflight --uninstall-hooks  remove Company Brain hooks only
```

Exit code `0` if safe to commit, else `1` (CI-friendly).

## Git hooks

Never installed automatically. `--install-hooks` writes `pre-commit`
(`--mode commit`, fast) and `pre-push` (full gate). `--uninstall-hooks` removes
only hooks carrying the Company Brain marker. If the CLI isn't on PATH, hooks
skip gracefully with a notice.

## Loop safety

- `maxAttempts` (default 5) counts consecutive failing runs per branch; the
  counter resets after a pass. At the cap: `humanReviewRequired: true` →
  "Stop. Human review is required."
- **Repeated failure** (same error-fingerprint signature): "This is still
  failing — the previous attempt did not resolve the issue."
- **Unrelated changes**: new changed files that no failure references → "You
  changed unrelated files. Focus only on the listed failures."
- **Fix regression**: old failures gone but new ones introduced → flagged.
- Full lineage persists in `preflight_attempts`.

## Security

- Commands never come from MCP input. Sources: repo config, detected
  package.json scripts, safe defaults. Base-binary allowlist
  (`npm/pnpm/yarn/bun/npx/node/tsx/tsc/eslint/biome/prettier/vitest/jest/next`);
  a repo config may allowlist additional **exact** full commands.
- Every command is rejected if it contains shell metacharacters, runs without
  shell interpolation (validated shell on Windows for `.cmd` shims), inside the
  repo root, with a hard timeout that kills the **whole process tree**.
- Output is capped and **secrets are redacted** (keys, tokens, connection
  strings, JWTs, private-key blocks) before storage or display.

## Persistence & dashboard

Runs persist to `preflight_runs / preflight_checks / preflight_errors /
preflight_fix_instructions / preflight_attempts / preflight_decision_violations`
(raw parsed errors link to their check row; agent fix instructions are their own
table). **`/app/preflight`** shows recent runs, checks, files with errors,
decision violations, and safe-to-commit status.

## HTTP API (server-side)

- `POST /api/repos/:id/preflight/run` — **remote knowledge preflight**: send
  `{ diff?, changedFiles?, files?: [{path, content}] }` and the server runs the
  checks that don't need a workspace — decision-graph, architecture rules
  (config + derived), secret scan — returning the same result contract
  (`mode: "remote"`). Command checks are reported as *skipped with reason*;
  this complements the local gate, it does not replace it.
- `GET /api/repos/:id/preflight` — recent runs + latest detail.
- `GET /api/repos/:id/preflight/runs/:runId` — one run's full detail.
- `GET /api/repos/:id/preflight/errors/:fingerprint` — explain one stored error.

## Troubleshooting

- **"No Preflight run yet"** — the repo isn't connected (no `repoId`); status
  and stored errors need a connected repo. `preflight_run` itself still works.
- **Everything AI-powered fails with 429** — the AI provider quota is exhausted
  (decision-check falls back to keyword-only and says so).
- **`build` says "Another next build process is already running"** — a dev
  server or stale build holds `.next/lock`; stop it or delete `.next/lock`.
- **A required check is "skipped" and the gate fails** — add the script to
  package.json, map it in config `commands`, or set `allowSkippedChecks: true`.

## Limitations (current)

- No CI/GitHub-Actions orchestration yet (the CLI's exit code works in CI
  today; the remote API covers knowledge checks server-side).
- Error parsers are strongest for tsc/ESLint/vitest/jest/Next; unknown tools
  fall back to a raw-output tail, category `unknown`.
- The AI half of `decision-check` needs a connected repo + AI quota; when the
  provider is down it degrades to the keyword engine + derived architecture
  rules (deterministic, still blocking) and says so in the check note.
- The decision-check diff is capped (~12KB); on very large changesets, later
  files may fall outside the AI window — the architecture-check has no such cap
  and remains the deterministic backstop.
- The loop is agent-driven: Preflight tracks state and instructs, but does not
  itself re-invoke the agent.
