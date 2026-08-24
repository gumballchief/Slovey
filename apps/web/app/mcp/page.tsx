import type { Metadata } from "next";
import { PageShell, InfoCard } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  alternates: { canonical: "/mcp" },
  title: "MCP Server — Slovey",
  description: "Run the Slovey MCP server against a self-hosted deployment so Claude, Cursor, Codex, and any MCP-capable agent can read your decisions. Hosted accounts use the REST API.",
};

export default function McpPage() {
  return (
    <PageShell
      eyebrow="Developers"
      title="MCP server"
      intro="Slovey exposes your engineering memory over the Model Context Protocol, so any MCP-capable agent can read your decisions, rules, and history before it writes code — one context layer for every tool."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard title="Claude Code">Add the Slovey MCP server so Claude queries your decision graph before acting on a change.</InfoCard>
        <InfoCard title="Cursor">Point Cursor at the same context layer your reviewers and CI use.</InfoCard>
        <InfoCard title="Codex &amp; others">Any agent that speaks MCP can connect to the same memory over a single endpoint.</InfoCard>
      </div>
      <div className="mt-8">
        <h2 className="text-lg font-medium">Setup (hosted)</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Install the CLI, create a token in your dashboard, and point your agent at the MCP server.
          No database — the server reads your decisions over the hosted API. The token is scoped to
          one repository, so a client can only ever reach that repo&apos;s decisions.
        </p>
        <pre className="mt-3 overflow-x-auto rounded bg-[var(--bg)] p-3 font-mono text-[13px] leading-relaxed">
{`npm i -g slovey   # provides the slovey-mcp binary

# .mcp.json (Claude Code, Cursor, …)
{
  "mcpServers": {
    "slovey": {
      "command": "slovey-mcp",
      "env": { "SLOVEY_TOKEN": "cb_…" }
    }
  }
}`}
        </pre>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Prefer HTTP? The same data is on the{" "}
          <a href="/api-reference" className="text-[var(--primary)] underline">REST API</a>.
          Running your own deployment? Set <code>DATABASE_URL</code> and{" "}
          <code>SLOVEY_REPO</code> instead of a token — see{" "}
          <a href="https://github.com/gumballchief/slovey/blob/main/apps/mcp/README.md" target="_blank" rel="noreferrer" className="text-[var(--primary)] underline">apps/mcp/README.md</a>.
        </p>
      </div>
    </PageShell>
  );
}
