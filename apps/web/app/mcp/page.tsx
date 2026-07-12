import type { Metadata } from "next";
import { PageShell, InfoCard } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title: "MCP Server — Slovey",
  description: "Connect Claude, Cursor, Codex, and any MCP-capable agent to your engineering memory through the Slovey MCP server.",
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
      <p className="mt-6 text-sm text-[var(--text-muted)]">
        Setup instructions live in the <a href="/docs" className="text-[var(--primary)] underline">docs</a>. Prefer HTTP? The same data is on the{" "}
        <a href="/api-reference" className="text-[var(--primary)] underline">REST API</a>.
      </p>
    </PageShell>
  );
}
