import type { Metadata } from "next";
import { PageShell, InfoCard } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title: "Documentation — Company Brain",
  description: "Get started with Company Brain: connect a repository, install the GitHub App, and run the pre-commit gate locally or in CI.",
};

export default function DocsPage() {
  return (
    <PageShell
      eyebrow="Documentation"
      title="Docs"
      intro="Everything you need to connect a repository and put your engineering memory to work. Full guides are being expanded — start with the quickstart below."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <InfoCard title="1 · Connect a repository">
          Sign in with GitHub and install the Company Brain GitHub App on the repos you want reviewed. We start building the decision graph from your PR history immediately.
        </InfoCard>
        <InfoCard title="2 · Run the pre-commit gate">
          Use the <code className="rounded bg-[var(--bg)] px-1 py-0.5 font-mono text-[13px]">companybrain</code> CLI to run the gate locally or in CI. It checks builds, tests, architecture, and prior decisions before a change lands.
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
