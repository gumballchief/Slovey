import type { Metadata } from "next";
import Link from "next/link";
import { SitePage } from "@/features/site/Site";

export const metadata: Metadata = {
  alternates: { canonical: "/docs" },
  title: "Docs",
  description: "Get started with Slovey: connect a repository, install the GitHub App, and run the pre-commit gate locally or in CI.",
};

export default function DocsPage() {
  return (
    <SitePage
      eyebrow="Docs"
      title={
        <>
          From zero to a gate <span className="dim">in five minutes.</span>
        </>
      }
      lede="Connect a repository, let Slovey learn your decisions, then put them in front of every agent and every pull request."
      art="/art/tile-preflight.webp"
      wide
    >
      <div className="st-section">
        <h2>Get started</h2>
        <div className="st-grid">
          <div className="st-card">
            <h3>Connect a repository</h3>
            <p>
              <Link href="/login" style={{ color: "var(--ice)" }}>Sign in with GitHub</Link> and install the Slovey GitHub
              app on the repositories you want covered. Slovey starts learning from their pull request history right away.
            </p>
          </div>
          <div className="st-card">
            <h3>Connect your agent</h3>
            <p>
              Add this address to Claude, ChatGPT, Codex, Cursor or Lovable and sign in with Slovey. Nothing to install; the
              Connect page in your dashboard walks you through each one.
            </p>
            <pre className="ui-code" style={{ fontSize: 12.5 }}>https://slovey.ai/api/mcp</pre>
          </div>
          <div className="st-card">
            <h3>Turn on the commit gate</h3>
            <p>Before a commit, locally or in CI: your build and tests, then every check against your team&apos;s decisions.</p>
            <pre className="ui-code" style={{ fontSize: 12.5 }}>{`npm install -g slovey
SLOVEY_TOKEN=cb_… slovey preflight --install-hooks`}</pre>
          </div>
        </div>
      </div>

      <div className="st-section">
        <h2>Go further</h2>
        <div className="st-grid">
          <Link className="st-card" href="/mcp">
            <h3>MCP server</h3>
            <p>Let Claude, Codex, Cursor and other agents read your decisions before they write code.</p>
          </Link>
          <Link className="st-card" href="/api-reference">
            <h3>API</h3>
            <p>Run Preflight and query the decision graph with a repository token.</p>
          </Link>
          <Link className="st-card" href="/integrations">
            <h3>Integrations</h3>
            <p>Learn from Slack, Notion, Jira, Confluence, Linear and PagerDuty as well as GitHub.</p>
          </Link>
          <Link className="st-card" href="/security">
            <h3>What we store</h3>
            <p>Decisions and links back to their pull requests. Not your source code.</p>
          </Link>
        </div>
      </div>

      <div className="st-section">
        <h2>How it decides</h2>
        <article className="st-prose" style={{ maxWidth: 760 }}>
          <p>
            Slovey reads merged and rejected pull requests, their review threads and your docs, and turns the reasoning
            into short decisions such as “charge retries stay capped at 3”, each linked to where it came from. Rejected
            pull requests matter as much as merged ones: they are how it learns what your team already tried.
          </p>
          <p>
            When a pull request opens or an agent runs Preflight, Slovey finds the decisions that apply to the files it
            touches and asks whether the change breaks one. A block always cites the decision and its source, so a person
            can check it in seconds, and marking a false alarm teaches it.
          </p>
          <p>
            Decisions show up in Reviews as they&apos;re learned. Approve the ones your team stands behind and reject any
            it got wrong.
          </p>
        </article>
      </div>
    </SitePage>
  );
}
