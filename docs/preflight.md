# Preflight — the agent-gating check system

Preflight is the gate an AI coding agent runs **after writing code and before
committing** (or marking a task done). It runs the project's real checks, checks
the diff against the Engineering Decision Graph, and returns **exact, agent-directed
fix instructions** — then the agent fixes and re-runs until it's clean.

```
agent writes code → preflight_run → checks + decision graph
   → fail? return fix instructions → agent fixes → preflight_run → …
   → pass → "safe to commit"
```

## How Claude Code (or any agent) uses it

The MCP server exposes five tools:

| Tool | When to call | Returns |
|---|---|---|
| `preflight_run` | after writing code, before committing | full structured JSON (status, checks, fixInstructions, decisionViolations) |
| `preflight_validate_commit` | the final gate before committing / finishing | `safeToCommit` + `agentGuidance` |
| `preflight_fix_instructions` | to see what to change | prioritized fix instructions + decision violations |
| `preflight_status` | to check the last result without re-running | pass/fail, attempt, humanReviewRequired |
| `preflight_explain_failure` | to understand a failure | plain-language explanation for the agent |

**Agent loop:** call `preflight_run` → if `safeToCommit` is false, apply every
`instructionForAgent`, then call `preflight_run` again → repeat until it passes or
it reports `humanReviewRequired` (stop and ask a human).

## Result schema (returned to the agent)

```jsonc
{
  "status": "pass" | "fail",
  "safeToCommit": true,
  "summary": "…",
  "checks": [{ "name": "typecheck", "status": "pass|fail|skipped", "command": "…", "durationMs": 0, "errors": [] }],
  "fixInstructions": [{ "priority": "critical|high|medium|low", "file": "…", "problem": "…", "instructionForAgent": "Agent, fix this before continuing. …", "evidence": "…" }],
  "decisionViolations": [{ "decisionId": "…", "title": "…", "violation": "…", "instructionForAgent": "Agent, do not commit. …", "confidence": 0.0, "evidence": [] }],
  // loop safety
  "attempt": 1, "maxAttempts": 5, "humanReviewRequired": false, "agentGuidance": "…", "branch": "…", "commitSha": "…", "runId": "…"
}
```

## Checks

- **Command-based** (auto-detected from `package.json`, or from config `commands`): `typecheck`, `lint`, `test`, `build`, `format`. Missing scripts are **skipped** with a reason, never failed.
- **Static:** `secret-scan` (hardcoded secrets in changed files), `env-check` (`process.env.X` not documented in `.env.example`), `route-check` (Next route handlers export a valid method), `deps` (lockfile present, `package.json` valid).
- **`decision-check`:** the diff vs the Decision Graph — active constraints, **rejected** approaches, deprecated/removed patterns, architecture rules, forbidden dependencies. Uses the AI judge, with a conservative keyword fallback for rejected decisions when AI is unavailable.

Example decision violation:
> Agent, do not commit. This reintroduces a REJECTED approach: "Redis was rejected in favor of the in-process CacheService." The diff imports `ioredis`. Replace it with the approved pattern, then run Preflight again.

## Configuration — `companybrain.preflight.json`

```json
{
  "requiredChecks": ["typecheck", "lint", "test", "build", "decision-check"],
  "maxAttempts": 5,
  "blockCommitOnFailure": true,
  "allowSkippedChecks": false,
  "timeoutMs": 120000,
  "commands": { "typecheck": "pnpm typecheck", "lint": "pnpm lint", "test": "pnpm test", "build": "pnpm build" }
}
```

A required check that fails **or** is skipped (unless `allowSkippedChecks`) fails the gate.

## CLI

```
companybrain preflight                 human-readable report
companybrain preflight --json          machine JSON (agents / CI)
companybrain preflight --fix-agent     agent-directed fix instructions only
companybrain preflight --check-only    static + command checks, skip decision graph
companybrain preflight --max-attempts 5
companybrain preflight --install-hooks install pre-commit + pre-push git hooks
```

Exit code `0` if safe to commit, else `1`.

## Git hooks

`companybrain preflight --install-hooks` writes `.git/hooks/pre-commit` (runs
`--check-only`) and `.git/hooks/pre-push` (full gate). Hooks are **not** installed
automatically. If the `companybrain` CLI isn't on PATH, the hooks skip gracefully.

## Loop safety

- `maxAttempts` (default 5): after that many consecutive failing attempts on a branch, Preflight returns **human review required** and tells the agent to stop.
- Repeated failures (same error signature across attempts) are detected → "This still fails — the previous fix did not resolve the issue."
- Attempt lineage is persisted in `preflight_attempts`.

## Security

- Only allowlisted binaries run (`npm/pnpm/yarn/bun/npx/node/tsx/tsc/eslint/biome/prettier/vitest/jest/next`); everything else is refused.
- Commands are validated against shell metacharacters and run **without a shell** (except a validated shell on Windows for `.cmd` shims) — no command injection.
- Per-check timeout kills runaway processes; output is capped and **secrets are redacted** from all captured output and stored logs.

## Persistence & dashboard

Runs persist to `preflight_runs / preflight_checks / preflight_errors /
preflight_attempts / preflight_decision_violations`. The dashboard at
**`/app/preflight`** shows recent runs, checks, files with errors, decision
violations, repeated failures, and safe-to-commit status.

## Setup

1. Apply the DB migration: `pnpm db:migrate` (creates the 5 preflight tables).
2. Point the MCP server at the local repo via `COMPANY_BRAIN_REPO` (owner/name) and, if not launched from the repo root, `COMPANY_BRAIN_REPO_PATH`.
3. (Optional) add `companybrain.preflight.json`; (optional) `companybrain preflight --install-hooks`.

## Limitations (current)

- Local repositories + Claude Code MCP only — no cloud orchestration.
- Error parsers are strongest for `tsc` and ESLint; other tools fall back to a captured-output tail.
- `decision-check` needs a connected repo (repoId) + AI/DB; without them it's skipped or runs keyword-only.
- The agent loop is driven by the agent re-calling the tool; Preflight tracks state but does not itself re-invoke the agent.
