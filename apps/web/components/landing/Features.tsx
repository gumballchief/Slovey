"use client";

import { MaskReveal, Reveal, RevealGroup, RevealItem } from "./motion";
import { TiltCard } from "./TiltCard";

type Feat = { title: string; body: string; icon: React.ReactNode };

const I = (d: string) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f7ef7" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    {d.split("|").map((p, i) => (p.startsWith("c:") ? <circle key={i} cx={+p.split(",")[1]!} cy={+p.split(",")[2]!} r={+p.split(",")[3]!} /> : <path key={i} d={p} />))}
  </svg>
);

const FEATURES: Feat[] = [
  { title: "Engineering Decision Graph", body: "A living, structured model of your architecture, standards, and history — the source of truth agents query before they act.", icon: I("c:,6,7.5,2|c:,18,7.5,2|c:,12,16.5,2|M7.8 9.1 10.5 14.6|M16.2 9.1 13.5 14.6|M8.1 7.5h7.8") },
  { title: "Continuous learning", body: "Ingests GitHub, PRs, ADRs, Slack, Notion, Jira, reviews, incidents, and human corrections — automatically, forever.", icon: I("M21 12a9 9 0 1 1-3-6.7|M21 4v4h-4") },
  { title: "Pre-commit review", body: "Every AI-generated change is checked, tested, and validated in the background before a human ever sees it.", icon: I("M12 3 4 6v5c0 5 3.4 8.3 8 10 4.6-1.7 8-5 8-10V6z|M9 12l2 2 4-4") },
  { title: "Company rule enforcement", body: "Encode conventions and constraints once. Slovey enforces them on every change, no reminders needed.", icon: I("M8 6h13|M8 12h13|M8 18h13|M3 6h.01|M3 12h.01|M3 18h.01") },
  { title: "Architecture guardrails", body: "Detects violations and deprecated patterns and blocks them, citing the decision or incident that made the rule.", icon: I("M12 3 4 6v5c0 5 3.4 8.3 8 10 4.6-1.7 8-5 8-10V6z|M12 8v4|M12 16h.01") },
  { title: "API & MCP server", body: "Connect any agent to your engineering memory over a REST API or MCP server — one context layer for every tool.", icon: I("M4 5h16v5H4z|M4 14h16v5H4z|M7.5 7.5h.01|M7.5 16.5h.01") },
];

export function Features() {
  return (
    <section id="features" style={{ position: "relative", zIndex: 1, maxWidth: 1180, margin: "0 auto", padding: "130px 24px 0" }}>
      <Reveal style={{ textAlign: "center", fontFamily: "var(--font-mono), monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#7fb0f2" }}>
        03 — Capabilities
      </Reveal>
      <MaskReveal delay={0.06} style={{ margin: "16px auto 0", maxWidth: 720, textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--font-display), sans-serif", fontWeight: 600, fontSize: "clamp(30px,4.4vw,50px)", lineHeight: 1.12, letterSpacing: "-0.025em", color: "var(--l-ink)", margin: 0, paddingBottom: "0.08em" }}>
          Everything an agent needs to write code your way
        </h2>
      </MaskReveal>

      <RevealGroup className="cb-feat-grid" >
        <div style={{ marginTop: 54, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, perspective: 1200 }}>
          {FEATURES.map((f) => (
            <RevealItem key={f.title}>
              <TiltCard
                className="cb-feat-card"
                style={{ borderRadius: 20, border: "1px solid var(--l-border)", background: "var(--l-card)", padding: 28, height: "100%", boxShadow: "0 20px 50px -30px rgba(30,40,90,.35)" }}
              >
                <div style={{ transform: "translateZ(38px)", width: 46, height: 46, borderRadius: 13, background: "var(--l-icon-chip)", display: "grid", placeItems: "center", marginBottom: 20 }}>
                  {f.icon}
                </div>
                <h3 style={{ transform: "translateZ(26px)", fontFamily: "var(--font-display), sans-serif", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--l-ink)", margin: "0 0 10px" }}>{f.title}</h3>
                <p style={{ transform: "translateZ(16px)", fontSize: 14.5, lineHeight: 1.6, color: "var(--l-body)", margin: 0 }}>{f.body}</p>
              </TiltCard>
            </RevealItem>
          ))}
        </div>
      </RevealGroup>
    </section>
  );
}
