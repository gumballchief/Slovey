"use client";

import { LogoGlyph } from "@/components/ui/Logo";

type Col = { title: string; links: [string, string][] };

const COLS: Col[] = [
  {
    title: "Product",
    links: [
      ["Overview", "#preview"],
      ["Features", "#features"],
      ["Workflow", "#workflow"],
      ["Pricing", "#pricing"],
      ["Changelog", "/changelog"],
    ],
  },
  {
    title: "Developers",
    links: [
      ["Documentation", "/docs"],
      ["API reference", "/api-reference"],
      ["MCP server", "/mcp"],
      ["Integrations", "/integrations"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Security", "/security"],
      ["Careers", "/careers"],
      ["Contact", "/contact"],
    ],
  },
];

const LEGAL: [string, string][] = [
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Security", "/security"],
];

/**
 * Footer — a real React component (was innerHTML with a hardcoded dark color that
 * vanished in dark mode). Editorial + mono-ink, theme-aware: a serif wordmark, a
 * technical mono column header, quiet links that ink on hover.
 */
export function FooterSection() {
  const link = (label: string, href: string, size: number, base: string) => (
    <a
      key={label}
      href={href}
      style={{ fontSize: size, color: `var(${base})`, textDecoration: "none", transition: "color .18s ease" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--l-ink)")}
      onMouseLeave={(e) => (e.currentTarget.style.color = `var(${base})`)}
    >
      {label}
    </a>
  );

  return (
    <footer style={{ position: "relative", zIndex: 1, borderTop: "1px solid var(--l-border)", marginTop: 48 }}>
      <div
        style={{ maxWidth: 1180, margin: "0 auto", padding: "66px 24px 44px", display: "grid", gridTemplateColumns: "1.7fr 1fr 1fr 1fr", gap: 40 }}
        data-footer-grid
      >
        {/* brand */}
        <div>
          <a href="#top" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--l-ink)" }}>
            <LogoGlyph size={28} />
            <span style={{ fontFamily: "var(--font-serif), Georgia, serif", fontWeight: 500, fontSize: 19, letterSpacing: "-0.01em" }}>Slovey</span>
          </a>
          <p style={{ margin: "16px 0 0", maxWidth: 280, fontSize: 14.5, lineHeight: 1.6, color: "var(--l-muted)" }}>
            The engineering intelligence layer beneath every AI coding assistant.
          </p>
        </div>

        {/* link columns */}
        {COLS.map((col) => (
          <div key={col.title}>
            <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--l-muted2)" }}>{col.title}</div>
            <ul style={{ listStyle: "none", padding: 0, margin: "18px 0 0", display: "grid", gap: 11 }}>
              {col.links.map(([label, href]) => (
                <li key={label}>{link(label, href, 14.5, "--l-muted")}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* bottom bar */}
      <div style={{ borderTop: "1px solid var(--l-border)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 24px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <span style={{ fontSize: 13, color: "var(--l-muted2)" }}>© 2026 Slovey, Inc.</span>
          <div style={{ display: "flex", gap: 20 }}>{LEGAL.map(([l, h]) => link(l, h, 13, "--l-muted2"))}</div>
          <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, letterSpacing: "0.02em", color: "var(--l-muted2)" }}>Built for engineers who ship.</span>
        </div>
      </div>
    </footer>
  );
}
