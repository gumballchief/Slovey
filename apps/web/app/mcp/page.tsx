import type { Metadata } from "next";
import Link from "next/link";
import { SitePage } from "@/features/site/Site";

export const metadata: Metadata = {
  alternates: { canonical: "/mcp" },
  title: "MCP server",
  description:
    "Connect Claude Code, Cursor, Codex and any MCP agent to your team's decisions with the Slovey MCP server. One repository-scoped token, no database.",
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
            <h3>Claude Code</h3>
            <p>Checks your decision graph before it acts on a change.</p>
          </div>
          <div className="st-card">
            <img src="/logos/cursor.svg" alt="" width={22} height={22} />
            <h3>Cursor</h3>
            <p>Uses the same context your reviewers and CI use.</p>
          </div>
          <div className="st-card">
            <span className="ui-mono" style={{ color: "var(--ice)" }}>MCP</span>
            <h3>Codex and others</h3>
            <p>Anything that speaks MCP connects to the same memory.</p>
          </div>
        </div>
      </div>

      <div className="st-section">
        <h2>Set it up</h2>
        <article className="st-prose" style={{ maxWidth: 760 }}>
          <p>
            Install the CLI, create a token in your dashboard (Settings, then CLI and agents), and add Slovey to your
            agent&apos;s MCP config. There&apos;s no database to run: the server reads your decisions over the hosted API.
            Each token is scoped to one repository, so an agent can only ever see that repository&apos;s decisions.
          </p>
          <pre>
            <code>{`npm i -g slovey   # includes the slovey-mcp server

# .mcp.json  (Claude Code, Cursor, ...)
{
  "mcpServers": {
    "slovey": {
      "command": "slovey-mcp",
      "env": { "SLOVEY_TOKEN": "cb_…" }
    }
  }
}`}</code>
          </pre>
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
