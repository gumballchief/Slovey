"use client";

import { useState } from "react";

type Plan = {
  name: string;
  tagline: string;
  priceAnnual: string;
  priceMonthly: string;
  suffix: string | null;
  note: { annual: string; monthly: string } | null;
  features: string[];
  cta: { label: string; href: string; kind: "primary" | "outline" };
  popular: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Starter",
    tagline: "For individual engineers",
    priceAnnual: "$0",
    priceMonthly: "$0",
    suffix: "/ forever",
    note: null,
    features: ["1 repository", "Pre-commit review", "Basic decision graph", "Community support"],
    cta: { label: "Start free", href: "/login", kind: "outline" },
    popular: false,
  },
  {
    name: "Team",
    tagline: "For teams shipping with AI daily",
    priceAnnual: "$19",
    priceMonthly: "$24",
    suffix: "/ user / mo",
    note: { annual: "Billed annually · 20% off", monthly: "Billed monthly" },
    features: [
      "Unlimited repositories",
      "Full Engineering Decision Graph",
      "Company rule enforcement",
      "MCP server + API access",
      "Slack, Notion, Jira, GitHub",
    ],
    cta: { label: "Start free trial", href: "/login", kind: "primary" },
    popular: true,
  },
  {
    name: "Enterprise",
    tagline: "For orgs with strict requirements",
    priceAnnual: "Custom",
    priceMonthly: "Custom",
    suffix: null,
    note: null,
    features: ["Self-hosted / VPC", "SSO, SCIM, audit logs", "Custom integrations", "Dedicated engineer"],
    cta: { label: "Talk to sales", href: "mailto:hello@slovey.dev?subject=Slovey%20Enterprise", kind: "outline" },
    popular: false,
  },
];

function Check() {
  return (
    <span style={{ display: "inline-flex", flexShrink: 0, color: "#4f7ef7" }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}

/**
 * Pricing — a real React component (was innerHTML wired by hand, which broke).
 * The monthly/annual toggle is plain `useState`; only the Team plan's price and
 * caption change. All text uses theme vars so it stays legible in dark mode
 * (the old markup hardcoded rgb(36,29,51), which was invisible on dark).
 */
export function PricingSection() {
  const [annual, setAnnual] = useState(true);

  const toggleBtn = (label: string, active: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "11px 18px",
        borderRadius: 9,
        border: "none",
        cursor: "pointer",
        fontFamily: "var(--font-inter-tight), sans-serif",
        fontSize: 14,
        fontWeight: 500,
        transition: "background .25s, color .25s",
        background: active ? "linear-gradient(120deg,#241d33,#463a63)" : "transparent",
        color: active ? "#fbfaff" : "var(--l-muted)",
      }}
    >
      {label}
    </button>
  );

  return (
    <section id="pricing" style={{ position: "relative", zIndex: 1, maxWidth: 1180, margin: "0 auto", padding: "130px 24px 0", textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#7fb0f2" }}>07 — Pricing</div>
      <h2 style={{ fontFamily: "var(--font-display), sans-serif", fontWeight: 600, fontSize: "clamp(30px,4.4vw,52px)", lineHeight: 1.06, letterSpacing: "-0.025em", margin: "16px auto 0", color: "var(--l-ink)" }}>
        Start free. Scale when it pays for itself.
      </h2>

      {/* monthly / annual toggle */}
      <div style={{ margin: "28px auto 0", display: "inline-flex", alignItems: "center", gap: 4, padding: 5, borderRadius: 12, border: "1px solid var(--l-border-soft)", background: "var(--l-card)" }}>
        {toggleBtn("Monthly", !annual, () => setAnnual(false))}
        {toggleBtn("Annual −20%", annual, () => setAnnual(true))}
      </div>

      {/* cards */}
      <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18, textAlign: "left", maxWidth: 1060, marginLeft: "auto", marginRight: "auto" }}>
        {PLANS.map((p) => {
          const price = annual ? p.priceAnnual : p.priceMonthly;
          return (
            <div
              key={p.name}
              style={{
                position: "relative",
                padding: "30px 28px",
                borderRadius: 20,
                border: p.popular ? "1px solid rgba(79,126,247,.45)" : "1px solid var(--l-border-soft)",
                background: p.popular ? "linear-gradient(rgba(79,126,247,.14),rgba(79,126,247,.02))" : "linear-gradient(var(--l-card),rgba(255,255,255,.01))",
              }}
            >
              {p.popular && (
                <div style={{ position: "absolute", top: 18, right: 18, padding: "5px 11px", borderRadius: 999, background: "linear-gradient(120deg,#4f7ef7,#7fb0f2)", color: "#fbfaff", fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", fontFamily: "var(--font-inter-tight), sans-serif" }}>
                  MOST POPULAR
                </div>
              )}
              <div style={{ fontFamily: "var(--font-display), sans-serif", fontWeight: 600, fontSize: 18, color: "var(--l-ink)" }}>{p.name}</div>
              <div style={{ marginTop: 6, fontSize: 14, color: "var(--l-muted)" }}>{p.tagline}</div>

              <div style={{ marginTop: 20, display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontFamily: "var(--font-display), sans-serif", fontWeight: 600, fontSize: 44, color: "var(--l-ink)" }}>{price}</span>
                {p.suffix && <span style={{ color: "var(--l-muted)", fontSize: 14 }}>{p.suffix}</span>}
              </div>
              {p.note && <div style={{ fontSize: 12.5, color: "var(--l-muted)", marginTop: 4 }}>{annual ? p.note.annual : p.note.monthly}</div>}

              <ul style={{ listStyle: "none", padding: 0, margin: "22px 0 0", display: "grid", gap: 12 }}>
                {p.features.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14.5, color: "var(--l-body)" }}>
                    <Check />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={p.cta.href}
                style={
                  p.cta.kind === "primary"
                    ? { display: "block", textAlign: "center", marginTop: 22, padding: 12, borderRadius: 11, background: "linear-gradient(120deg,#241d33,#463a63)", color: "#fbfaff", textDecoration: "none", fontWeight: 600, fontSize: 14.5, boxShadow: "0 12px 34px -14px rgba(255,120,100,.8)" }
                    : { display: "block", textAlign: "center", marginTop: 22, padding: 12, borderRadius: 11, border: "1px solid var(--l-border-soft)", background: "var(--l-card)", color: "var(--l-body)", textDecoration: "none", fontWeight: 500, fontSize: 14.5 }
                }
              >
                {p.cta.label}
              </a>
            </div>
          );
        })}
      </div>
    </section>
  );
}
