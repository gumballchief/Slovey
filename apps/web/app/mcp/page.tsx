import type { Metadata } from "next";
import Link from "next/link";
import { SitePage } from "@/features/site/Site";

export const metadata: Metadata = {
  alternates: { canonical: "/mcp" },
  title: "MCP server",
  description:
    "Connect Claude, ChatGPT, Codex, Cursor and any MCP agent to your team's decisions with the Slovey MCP server. Add one URL and sign in with Slovey.",
};

export default function McpPage() {
  return (
    <SitePage
      eyebrow="MCP server"
      title={
        <>
          One memory <span className="dim">for every agent.</span>
        </>
      }
      lede="Slovey speaks the Model Context Protocol, so any MCP-capable agent can read your decisions, rules and history before it writes a line."
      art="/art/tile-mcp.webp"
      wide
    >
      <div className="st-section">
        <div className="st-grid">
          <div className="st-card">
            <img src="/logos/claude.svg" alt="" width={22} height={22} />
            <h3>Claude</h3>
            <p>In the Claude app, on claude.ai and in Claude Code. Checks your decisions before it acts on a change.</p>
          </div>
          <div className="st-card">
            <img src="/logos/codex.svg" alt="" width={22} height={22} />
            <h3>Codex and ChatGPT</h3>
            <p>One command in Codex, or a custom MCP server in ChatGPT.</p>
          </div>
          <div className="st-card">
            <img src="/logos/cursor.svg" alt="" width={22} height={22} />
            <h3>Cursor, VS Code and more</h3>
            <p>One click in Cursor and VS Code. Anything that speaks MCP connects to the same memory.</p>
          </div>
        </div>
      </div>

      <div className="st-section">
        <h2>Set it up</h2>
        <article className="st-prose" style={{ maxWidth: 760 }}>
          <p>
            There is nothing to install or run. Add this address to your agent and it signs in with Slovey: you pick the
            repository it may read and click Allow. Access is scoped to that one repository, and you can remove it any
            time in Settings.
          </p>
          <pre>
            <code>https://slovey.ai/api/mcp</code>
          </pre>
          <p>
            In Claude (the app or claude.ai), open Settings, then Connectors, then Add custom connector, and paste it. In
            Claude Code it is one command, then <code>/mcp</code> to sign in:
          </p>
          <pre>
            <code>claude mcp add --transport http slovey https://slovey.ai/api/mcp</code>
          </pre>
          <p>In Codex, the app, the IDE extension and the CLI share one setup:</p>
          <pre>
            <code>codex mcp add slovey --url https://slovey.ai/api/mcp</code>
          </pre>
          <p>
            In ChatGPT, open Plugins and add a custom MCP server with the same address. Cursor and VS Code get a one-click
            install on the Connect page in your dashboard, which also shows the moment your agent first reaches Slovey.
          </p>
          <p>
            Your agent then gets six tools: <code>what_applies_here</code>, <code>plan</code>, <code>can_i</code>,{" "}
            <code>ask</code>, <code>get_rejected</code> and <code>check_change</code>, which checks a diff before it is
            committed. Prefer a local server? <code>npm i -g slovey</code> ships <code>slovey-mcp</code>, which also
            runs Preflight against your working tree.
          </p>
          <p>
            Prefer HTTP? The same answers are on the <Link href="/api-reference">API</Link>. Running Slovey yourself? Set{" "}
            <code>DATABASE_URL</code> and <code>SLOVEY_REPO</code> instead of a token; see{" "}
            <a href="https://github.com/gumballchief/slovey/blob/main/apps/mcp/README.md" target="_blank" rel="noreferrer">
              the MCP readme
            </a>
            .
          </p>
        </article>
      </div>
    </SitePage>
  );
}
