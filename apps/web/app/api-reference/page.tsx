import type { Metadata } from "next";
import Link from "next/link";
import { SitePage } from "@/features/site/Site";

export const metadata: Metadata = {
  alternates: { canonical: "/api-reference" },
  title: "API",
  description: "The Slovey API: run Preflight on a change and query your team's decision graph with a repository-scoped token.",
};

const OPS: Array<[string, string, string]> = [
  ["what_applies_here", "{ paths?, services?, domains?, languages?, frameworks? }", "The decisions that govern the code you're about to touch."],
  ["can_i", "{ intent }", "Whether a change is allowed under your decisions, with what was tried before."],
  ["ask", "{ question }", "A cited answer about why the code is the way it is."],
  ["plan", "{ request }", "A step-by-step plan that stays inside your decisions."],
  ["rejected", "{ query?, limit? }", "Approaches your team already tried and turned down."],
  ["search", "{ query }", "Search every decision by meaning."],
];

export default function ApiReferencePage() {
  return (
    <SitePage
      eyebrow="API"
      title={
        <>
          Three endpoints. <span className="dim">The whole memory.</span>
        </>
      }
      lede="Agents and CI talk to Slovey with a repository-scoped token. Create one in the dashboard under Connect and send it as a Bearer header."
      art="/art/tile-repo.webp"
    >
      <article className="st-prose">
        <h2>Authentication</h2>
        <pre>
          <code>{`Authorization: Bearer cb_…`}</code>
        </pre>
        <p>
          A token only reaches the one repository it was made for, and you can revoke it any time. The dashboard&apos;s own
          endpoints use your signed-in session instead and aren&apos;t meant for scripts.
        </p>

        <h2 className="st-endpoint">POST <code>/api/cli/preflight</code></h2>
        <p>
          Checks a change against your decisions and architecture rules and returns a verdict: whether it&apos;s safe to
          commit, which decisions it breaks, and instructions an agent can act on. This is what{" "}
          <code>slovey preflight</code> calls.
        </p>
        <pre>
          <code>{`{
  "diff": "diff --git a/src/... ",
  "changedFiles": ["src/charges/retry.ts"],
  "files": [{ "path": "src/charges/retry.ts", "content": "..." }],
  "branch": "feature/retries",
  "commitSha": null
}`}</code>
        </pre>

        <h2 className="st-endpoint">POST <code>/api/cli/knowledge</code></h2>
        <p>
          Queries the decision graph. Send an <code>op</code> and its <code>args</code>:
        </p>
        <pre>
          <code>{`{ "op": "can_i", "args": { "intent": "add Redis caching to the auth service" } }`}</code>
        </pre>
      </article>

      <div className="ui-card ui-table-wrap" style={{ marginTop: 24 }}>
        <table className="ui-table">
          <thead>
            <tr>
              <th style={{ paddingTop: 14 }}>op</th>
              <th style={{ paddingTop: 14 }}>args</th>
              <th style={{ paddingTop: 14 }}>Returns</th>
            </tr>
          </thead>
          <tbody>
            {OPS.map(([op, args, what]) => (
              <tr key={op}>
                <td className="ui-mono" style={{ color: "var(--ice)" }}>{op}</td>
                <td className="ui-mono ui-small">{args}</td>
                <td style={{ color: "var(--text)" }}>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <article className="st-prose" style={{ marginTop: 46 }}>
        <h2 className="st-endpoint">
          POST <code>/api/mcp</code>
        </h2>
        <p>
          The same memory as a remote MCP server (Streamable HTTP, stateless, JSON responses) at{" "}
          <code>https://slovey.ai/api/mcp</code>. Clients sign in with OAuth 2.1 (PKCE, dynamic client registration,
          discovery through <code>/.well-known/oauth-protected-resource</code>), or send the Bearer header above. Tools: <code>what_applies_here</code>,{" "}
          <code>plan</code>, <code>can_i</code>, <code>ask</code>, <code>get_rejected</code> and <code>check_change</code>,
          which takes a unified diff and says whether it is safe to commit.
        </p>
      </article>
      <p className="ui-small" style={{ marginTop: 24 }}>
        New here? Start with the <Link href="/docs" style={{ color: "var(--ice)" }}>docs</Link>.
      </p>
    </SitePage>
  );
}
