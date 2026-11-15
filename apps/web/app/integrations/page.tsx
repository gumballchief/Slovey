import type { Metadata } from "next";
import Link from "next/link";
import { SitePage } from "@/features/site/Site";

export const metadata: Metadata = {
  alternates: { canonical: "/integrations" },
  title: "Integrations",
  description:
    "Slovey learns from GitHub, Slack, Notion, Jira, Confluence, Linear and PagerDuty, and feeds that memory to Claude, Codex, Cursor and any MCP agent.",
};

const SOURCES: Array<{ name: string; logo?: string; what: string }> = [
  { name: "GitHub", logo: "/logos/github.svg", what: "Merged and rejected pull requests, reviews and repo docs. Always on." },
  { name: "Slack", what: "Threads in the channels you pick, where decisions get argued out." },
  { name: "Notion", logo: "/logos/notion.svg", what: "Specs, RFCs and design docs." },
  { name: "Jira", logo: "/logos/jira.svg", what: "Tickets and the reasoning in their comments." },
  { name: "Confluence", what: "Architecture pages and runbooks." },
  { name: "Linear", what: "Issues and project decisions." },
  { name: "Discord", what: "Engineering channels." },
  { name: "PagerDuty", logo: "/logos/pagerduty.svg", what: "Incidents, so a postmortem becomes a rule." },
];
const AGENTS: Array<{ name: string; logo?: string; what: string }> = [
  { name: "Claude", logo: "/logos/claude.svg", what: "The app, claude.ai and Claude Code read your decisions over MCP before they edit, and run Preflight before they commit." },
  { name: "Codex", logo: "/logos/codex.svg", what: "The Codex app, IDE extension and CLI, over MCP with one command." },
  { name: "Cursor", logo: "/logos/cursor.svg", what: "The same memory your reviewers and CI use, over MCP." },
  { name: "ChatGPT, Lovable and others", what: "Any agent that speaks MCP, or anything that can call a CLI." },
  { name: "Your CI", what: "slovey preflight in any pipeline, as a required check." },
];

function Grid({ items }: { items: Array<{ name: string; logo?: string; what: string }> }) {
  return (
    <div className="st-grid">
      {items.map((i) => (
        <div key={i.name} className="st-card">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="ui-row-icon" style={{ width: 38, height: 38 }}>
              {i.logo ? <img src={i.logo} alt="" width={18} height={18} /> : <span className="ui-mono">{i.name.slice(0, 1)}</span>}
            </span>
            <h3>{i.name}</h3>
          </div>
          <p>{i.what}</p>
        </div>
      ))}
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <SitePage
      eyebrow="Integrations"
      title={
        <>
          Learns where you decide. <span className="dim">Works where you code.</span>
        </>
      }
      lede="Slovey reads the places your engineering decisions actually happen and feeds that memory to the agents that write your code."
      art="/art/obj-7.webp"
      wide
    >
      <div className="st-section">
        <h2>Sources it learns from</h2>
        <Grid items={SOURCES} />
      </div>
      <div className="st-section">
        <h2>Agents that use the memory</h2>
        <Grid items={AGENTS} />
      </div>
      <p className="ui-small" style={{ marginTop: 40 }}>
        Missing one you need? <Link href="/contact" style={{ color: "var(--ice)" }}>Tell us</Link> what to build next.
      </p>
    </SitePage>
  );
}
