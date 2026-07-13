import { LogoGlyph } from "@/components/ui/Logo";

// Footer for the standalone marketing/legal pages (the animated landing has its
// own inline footer). Mirrors the landing's link structure so nothing dead-ends.
const COLUMNS: { heading: string; links: [string, string][] }[] = [
  {
    heading: "Product",
    links: [
      ["Overview", "/#top"],
      ["Features", "/#features"],
      ["Workflow", "/#workflow"],
      ["Pricing", "/#pricing"],
      ["Changelog", "/changelog"],
    ],
  },
  {
    heading: "Developers",
    links: [
      ["Documentation", "/docs"],
      ["API reference", "/api-reference"],
      ["MCP server", "/mcp"],
      ["Integrations", "/integrations"],
    ],
  },
  {
    heading: "Company",
    links: [
      ["About", "/about"],
      ["Security", "/security"],
      ["Careers", "/careers"],
      ["Contact", "/contact"],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-subtle)]">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <a href="/" className="flex items-center gap-2.5" aria-label="Slovey home">
              <LogoGlyph size={30} />
              <span className="font-display text-sm font-semibold tracking-[-0.02em]">Slovey</span>
            </a>
            <p className="mt-3 max-w-xs text-sm text-[var(--text-muted)]">
              The engineering-memory layer beneath your AI coding agents.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h2 className="label-mono text-[var(--text-muted)]">{col.heading}</h2>
              <ul className="mt-4 space-y-1">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="inline-flex min-h-[44px] items-center text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--cb-text)] focus-visible:text-[var(--cb-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-6">
          <span className="text-[13px] text-[var(--text-muted)]">© 2026 Slovey, Inc. All rights reserved.</span>
          <nav className="flex flex-wrap gap-5" aria-label="Legal">
            {[
              ["Privacy", "/privacy"],
              ["Terms", "/terms"],
              ["Security", "/security"],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="text-[13px] text-[var(--text-muted)] transition-colors hover:text-[var(--cb-text)] focus-visible:text-[var(--cb-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
