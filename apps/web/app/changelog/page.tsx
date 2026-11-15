import type { Metadata } from "next";
import { SitePage } from "@/features/site/Site";

export const metadata: Metadata = {
  alternates: { canonical: "/changelog" },
  title: "Changelog",
  description: "What's new in Slovey: product updates, new checks and integrations as they ship.",
};

const RELEASES: Array<{ date: string; title: string; items: string[] }> = [
  {
    date: "November 2026",
    title: "A new Slovey",
    items: [
      "Slovey now lives at slovey.ai. Links to slovey.dev keep working and bring you here.",
      "Sign in with Slovey from your agent: add slovey.ai/api/mcp as a connector in Claude, Claude Code, Cursor or VS Code, sign in, pick a repository and click Allow. Nothing to install and no key to copy. A new Connect page walks you through it and shows the moment your agent first reaches Slovey.",
      "Agents can now send a diff to Slovey before committing and get back exactly which decisions it breaks and how to fix it.",
      "A redesigned dashboard: Today shows what needs you, Memory draws your decisions as a map linked to the pull requests and incidents behind them, Reviews lets you approve learned decisions from the keyboard, and Ask answers with sources.",
      "Upgrading to Team now happens on slovey.ai with a checkout that matches the product. Seats and yearly or monthly billing are set right on the page.",
      "Paste a diff on the Preflight page and Slovey checks it against your decisions on the spot.",
      "Repositories keep their history when they're renamed or transferred on GitHub.",
      "If the GitHub app is uninstalled, Slovey stops scanning that account and keeps its data in case you come back. A nightly check keeps installs in sync with GitHub even if a notification is missed.",
      "The CLI stops a commit when its token is rejected, with a clear message, instead of quietly skipping the decision check.",
    ],
  },
  {
    date: "November 2026",
    title: "A hardened backend",
    items: [
      "More than 300 fixes from a round-the-clock adversarial review of every backend file, each one shipped with a test.",
      "Stricter workspace isolation, verified GitHub identities and signed webhooks throughout.",
      "Everything untrusted that reaches the AI (pull request text, docs, connector content) is fenced off as data, never followed as instructions.",
      "Billing only upgrades a workspace once a payment has actually cleared.",
    ],
  },
  {
    date: "August 2026",
    title: "Open source",
    items: [
      "Slovey is MIT licensed.",
      "Security headers on every page, and every high-severity dependency advisory cleared.",
      "The hosted MCP server and the CLI now read decisions over the API, so agents need no database.",
    ],
  },
  {
    date: "July 2026",
    title: "The CLI and incidents",
    items: [
      "The slovey CLI is published to npm: run Preflight locally or in CI.",
      "PagerDuty incidents feed the memory, so a postmortem can become a rule.",
      "Ask streams its answer word by word.",
      "Preflight enforces architecture layering rules.",
      "Sign in with Google and link GitHub later; upload a profile picture.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <SitePage
      eyebrow="Changelog"
      title={
        <>
          What&apos;s new <span className="dim">in Slovey.</span>
        </>
      }
      lede="Product updates, new checks and integrations as they ship."
      art="/art/obj-5.webp"
    >
      <div style={{ display: "grid", gap: 56 }}>
        {RELEASES.map((r) => (
          <section key={r.title} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 24 }} className="st-release">
            <div className="ui-eyebrow" style={{ paddingTop: 8 }}>{r.date}</div>
            <article className="st-prose">
              <h2 style={{ marginTop: 0 }}>{r.title}</h2>
              <ul>
                {r.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </article>
          </section>
        ))}
      </div>
    </SitePage>
  );
}
