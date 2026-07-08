import type { Metadata } from "next";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title: "API Reference — Company Brain",
  description: "The Company Brain REST API: query the decision graph, run preflight checks, and manage repositories with a token-authenticated endpoint.",
};

const ENDPOINTS: [string, string, string][] = [
  ["GET", "/api/repos", "List repositories connected to your account."],
  ["GET", "/api/repos/:id/context", "Fetch the decision context an agent should read before acting."],
  ["POST", "/api/repos/:id/can-i", "Ask whether a proposed change is allowed under your rules and prior decisions."],
  ["POST", "/api/cli/preflight", "Run the pre-commit gate on a diff and get a pass/fail with reasons."],
  ["GET", "/api/repos/:id/decisions", "List the decisions in the repository's engineering memory."],
];

export default function ApiReferencePage() {
  return (
    <PageShell
      eyebrow="Developers"
      title="API reference"
      intro="Every capability is available over a token-authenticated REST API. Mint a token from your dashboard and send it as a Bearer header. Full reference docs are expanding — here are the core endpoints."
    >
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-[var(--bg-subtle)] text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Method</th>
              <th className="px-4 py-3 font-medium">Endpoint</th>
              <th className="px-4 py-3 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {ENDPOINTS.map(([method, path, desc]) => (
              <tr key={path} className="border-t border-[var(--border)]">
                <td className="px-4 py-3">
                  <span className="rounded bg-[var(--primary)]/10 px-2 py-1 font-mono text-[12px] font-semibold text-[var(--primary)]">{method}</span>
                </td>
                <td className="px-4 py-3 font-mono text-[13px] text-[var(--cb-text)]">{path}</td>
                <td className="px-4 py-3 text-[var(--text-muted)]">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-sm text-[var(--text-muted)]">
        Authenticate with <code className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono text-[13px]">Authorization: Bearer &lt;token&gt;</code>. See the{" "}
        <a href="/docs" className="text-[var(--primary)] underline">docs</a> to get set up.
      </p>
    </PageShell>
  );
}
