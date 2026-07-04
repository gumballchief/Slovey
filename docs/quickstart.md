# Quickstart

Company Brain learns your team's engineering decisions and enforces them — on
pull requests, and (optionally) before your AI coding agent commits. There are
two ways to use it. **Path A works today with zero local setup.** Path B (the
local gate) currently needs this repo cloned — see the note under it.

---

## Path A — GitHub App (recommended, no code)

Reviews every PR against the decisions Company Brain has learned from your
history, and comments when a change conflicts with one — always citing the
specific decision and the PR it came from.

1. **Install the app** on the repo you want:
   → https://github.com/apps/company-brain/installations/new
   Pick the repository (grant it a single repo to start; you can add more later).

2. **Sign in with GitHub** at the dashboard so it can match your repositories to
   your account. (Google/email sign-in works for browsing but *cannot* see repos
   — repo access is tied to your GitHub identity. If you land on an empty
   dashboard, use **Reconnect GitHub**.)

3. **Let it index.** On connect, Company Brain scans your merged PRs and docs for
   the decisions your team already made. This runs in the background and takes a
   few minutes on a large history; decisions appear on the **Memory** page as
   they're found. You can also add a decision by hand there at any time.

4. **Open a pull request.** Company Brain checks it and, if it reintroduces
   something your team rejected (or breaks an active decision), leaves a review
   comment with the citation. Reply `/brain dismiss` on a comment to teach it a
   false positive, or `/brain confirm` to reinforce it.

That's the whole self-serve loop. Nothing to install locally.

---

## Path B — Preflight gate for your coding agent (before commit)

Preflight runs the same decision checks — plus build/typecheck/tests, secret
scan, architecture and performance rules — **locally, before a commit**, and
hands your AI agent exact fix instructions until the change is safe.

> **Heads up (honest status):** the Preflight CLI/MCP server is not published to
> npm yet, so today it runs from a clone of this repo (`company-brain`). A
> standalone `npx companybrain` package is the planned next step. The steps below
> assume you've cloned this repo and run `pnpm install` in it.

### 1. Point your coding agent at the MCP server

Add this to your agent's MCP config (`.mcp.json` for Claude Code; the equivalent
for Cursor / Windsurf / Codex / Gemini CLI / Aider / Continue.dev):

```json
{
  "mcpServers": {
    "company-brain": {
      "command": "npx",
      "args": ["-y", "tsx", "apps/mcp/src/index.ts"],
      "env": {
        "COMPANY_BRAIN_REPO": "owner/name",
        "COMPANY_BRAIN_REPO_PATH": "/absolute/path/to/your/repo"
      }
    }
  }
}
```

Then add one line to your agent's rules file (`CLAUDE.md`, Cursor rules, etc.):

> Before committing, call Company Brain `preflight_run`. If `safeToCommit` is
> false, apply every `fixInstructions` item and run it again. Do not commit until
> `safeToCommit` is true, or `humanReviewRequired` is true (then stop and ask a
> human). If a human explicitly approves a blocked change, **show** them the
> `preflight override …` command from `nextSteps` — never run it yourself.

### 2. Or run it directly from the terminal

```bash
# from your repo (with this monorepo available for the CLI):
companybrain doctor                  # check your setup first — tells you exactly what's missing
companybrain preflight init          # write a starter companybrain.preflight.json
companybrain preflight               # full human-readable gate
companybrain preflight --json        # machine JSON (for CI)
companybrain preflight --mode commit # fast pre-commit gate
```

If the `companybrain` bin isn't on your PATH, invoke it from the clone:
`npx tsx apps/mcp/src/cli.ts preflight`.

### 3. (Optional) Install git hooks

```bash
companybrain preflight --install-hooks     # pre-commit (mode: commit) + pre-push (full)
companybrain preflight --uninstall-hooks   # remove them
```

### When a decision blocks you and it's wrong

If the decision itself is out of date, fix the **record** on the Memory page
(permanent). If it's a one-time exception you approve, record a time-boxed
override — the gate prints the exact command:

```bash
companybrain preflight override <decisionId> --reason "why" [--hours 168]
```

Overrides are attributed to you and expire (default one week); agents surface
the command but must not run it themselves.

---

## What's ready vs. not (so you're not surprised)

| Capability | Status |
|---|---|
| GitHub App PR review with decision citations | ✅ self-serve today |
| Decision memory auto-indexed from history + manual entry | ✅ |
| Dashboard, first-run onboarding, GitHub-first login | ✅ |
| Preflight local gate + MCP + git hooks | ✅ works from a clone of this repo |
| `npx companybrain` standalone package (no clone) | ⏳ planned |
| Slack / Jira / Notion / Confluence sources | ⏳ planned |
| Stripe billing | ⚙️ built, needs keys configured |

See **[preflight.md](./preflight.md)** for the full Preflight reference (modes,
the JSON contract, config options, the agent roster) and
**[agent-auto-pr.md](./agent-auto-pr.md)** for the auto-PR agent.
