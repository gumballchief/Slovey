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
      intro="Slovey exposes your engineering memory over the Model Context Protocol, so any MCP-capable agent can read your decisions, rules, and history before it writes code. Today the MCP server talks to the decision graph directly, so it runs against a self-hosted deployment — if you are on a hosted account, use the REST API, which serves the same data."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard title="Claude Code">Add the Slovey MCP server so Claude queries your decision graph before acting on a change.</InfoCard>
        <InfoCard title="Cursor">Point Cursor at the same context layer your reviewers and CI use.</InfoCard>
        <InfoCard title="Codex &amp; others">Any agent that speaks MCP can connect to the same memory over a single endpoint.</InfoCard>
      </div>
      <div className="mt-8">
        <h2 className="text-lg font-medium">Self-hosted setup</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Clone the repo, run the stack, then point your agent at the server. It needs a database
          connection and the repo it should serve — there is no silent default, so a misconfigured
          client cannot read another organization&apos;s decisions.
        </p>
        <pre className="mt-3 overflow-x-auto rounded bg-[var(--bg)] p-3 font-mono text-[13px] leading-relaxed">
{`{
  "mcpServers": {
    "slovey": {
      "command": "node",
      "args": ["apps/mcp/dist/index.mjs"],
      "env": {
        "DATABASE_URL": "postgres://…",
        "COMPANY_BRAIN_REPO": "owner/name"
      }
    }
  }
}`}
        </pre>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Full instructions are in{" "}
          <a href="https://github.com/gumballchief/slovey/blob/main/apps/mcp/README.md" target="_blank" rel="noreferrer" className="text-[var(--primary)] underline">apps/mcp/README.md</a>.
          On a hosted account, use the{" "}
          <a href="/api-reference" className="text-[var(--primary)] underline">REST API</a> — it serves the same data and needs only a token.
        </p>
      </div>
    </PageShell>
  );
}
