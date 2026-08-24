import type { Metadata } from "next";
import { PageShell, InfoCard } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  alternates: { canonical: "/docs" },
  title: "Documentation — Slovey",
  description: "Get started with Slovey: connect a repository, install the GitHub App, and run the pre-commit gate locally or in CI.",
};

export default function DocsPage() {
  return (
    <PageShell
      eyebrow="Documentation"
      title="Docs"
      intro="Everything you need to connect a repository and put your engineering memory to work."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <InfoCard title="1 · Connect a repository">
          Sign in with GitHub and install the Slovey GitHub App on the repos you want reviewed. We start building the decision graph from your PR history immediately.
        </InfoCard>
        <InfoCard title="2 · Install the CLI">
          <span className="block">Node 18 or newer.</span>
          <pre className="mt-2 overflow-x-auto rounded bg-[var(--bg)] p-3 font-mono text-[13px] leading-relaxed">
{`npm install -g slovey
slovey doctor              # confirm setup
slovey preflight --mode commit`}
          </pre>
          <span className="mt-2 block">Or run it without installing: <code className="rounded bg-[var(--bg)] px-1 py-0.5 font-mono text-[13px]">npx slovey@latest doctor</code></span>
        </InfoCard>
        <InfoCard title="3 · Run the gate">
          <code className="rounded bg-[var(--bg)] px-1 py-0.5 font-mono text-[13px]">slovey preflight</code> runs locally or in CI: your build, your tests, then architecture and prior-decision checks before a change lands.
        </InfoCard>
        <InfoCard title="API reference" href="/api-reference">
          Talk to the decision graph directly over a token-authenticated REST API.
        </InfoCard>
        <InfoCard title="MCP server" href="/mcp">
          Wire Claude, Cursor, Codex, and other agents to your memory over MCP.
        </InfoCard>
      </div>
    </PageShell>
  );
}
