# Company Brain — MCP Server

The engineering **knowledge layer** that AI coding agents (Claude Code, Cursor,
Windsurf, …) consult **before** writing code. It exposes your team's Engineering
Decision Graph over the Model Context Protocol so an agent can ask "what governs
this?", "can I do this?", and "what was already rejected?" — and get cited,
evidence-backed answers instead of guessing.

The server is scoped to **one repository's** decisions. There is no default — a
misconfigured client cannot read another organization's knowledge.

## Tools

| Tool | Use |
|------|-----|
| `what_applies_here` | Active decisions governing the files/services a change touches. **Call before writing code.** |
| `plan` | Evidence-backed implementation plan for a request (intent, verdict, risk, blockers, steps). |
| `can_i` | Is an intended change allowed? `allowed`/`disallowed`/`unclear` + cited reasoning + rejected precedent. |
| `ask` | Natural-language Q&A over decisions ("why don't we use Redis?"). Cited, or declines if no evidence. |
| `get_rejected` | Approaches the team already rejected — so the agent doesn't re-propose them. |

## Requirements

- **Node ≥ 22** and `pnpm`.
- A `.env` at the repo root with at least `DATABASE_URL` and your AI/embedding
  keys (same `.env` the web app and worker use).
- `COMPANY_BRAIN_REPO=owner/repo` — the repository whose decisions to serve. It
  must already be connected to Company Brain (GitHub App installed).

The server validates all of the above **at startup** and exits with an
actionable message if anything is missing — it never starts half-configured.

## Run it directly (smoke test)

```bash
COMPANY_BRAIN_REPO=your-org/your-repo pnpm --filter @company-brain/mcp start
# → [company-brain mcp] ready · repo your-org/your-repo · v0.1.0
```

(Run from the repo root so the root `.env` is picked up. Logs go to stderr;
stdout is the JSON-RPC channel.)

## Install in Claude Code

From the repo root:

```bash
claude mcp add company-brain \
  --env COMPANY_BRAIN_REPO=your-org/your-repo \
  -- pnpm --filter @company-brain/mcp start
```

Then in a session: *"Ask company-brain what applies here before you change the
billing code."*

## Install in Cursor

Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global). Cursor runs
the command from the workspace root, so point the workspace at this repo:

```json
{
  "mcpServers": {
    "company-brain": {
      "command": "pnpm",
      "args": ["--filter", "@company-brain/mcp", "start"],
      "env": { "COMPANY_BRAIN_REPO": "your-org/your-repo" }
    }
  }
}
```

## Notes

- **Scope per repo.** To serve several repos, register one MCP entry per repo
  with a distinct name and `COMPANY_BRAIN_REPO`.
- **Read-only.** Every tool reads through the Decision API; the server never
  writes to the graph.
- **Failure is graceful.** A transient error in one tool returns a readable
  error to the agent rather than crashing the server.
