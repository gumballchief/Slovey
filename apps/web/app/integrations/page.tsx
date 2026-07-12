import type { Metadata } from "next";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title: "Integrations — Slovey",
  description: "Slovey connects to the tools your team already uses — GitHub, Slack, Notion, Jira, and the AI coding agents your engineers run.",
};

// The tools surfaced on the landing marquee. Ingestion sources feed the memory;
// agent tools consume it.
const SOURCES = ["GitHub", "Slack", "Notion", "Jira", "Confluence", "Linear"];
const AGENTS = ["VS Code", "Cursor", "Claude Code", "Codex", "Gemini CLI", "MCP"];

function Grid({ items }: { items: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((name) => (
        <div key={name} className="flex min-h-[56px] items-center rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 font-display font-semibold tracking-[-0.01em] text-[var(--cb-text)]">
          {name}
        </div>
      ))}
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <PageShell
      eyebrow="Developers"
      title="Integrations"
      intro="Slovey reads from the systems where your engineering decisions actually happen, and feeds that memory back to the agents where code gets written."
    >
      <h2 className="label-mono text-[var(--text-muted)]">Sources we learn from</h2>
      <div className="mt-4">
        <Grid items={SOURCES} />
      </div>
      <h2 className="label-mono mt-12 text-[var(--text-muted)]">Agents that use the memory</h2>
      <div className="mt-4">
        <Grid items={AGENTS} />
      </div>
      <p className="mt-8 text-sm text-[var(--text-muted)]">
        Missing one you need? <a href="/contact" className="text-[var(--primary)] underline">Tell us</a> what to prioritize.
      </p>
    </PageShell>
  );
}
