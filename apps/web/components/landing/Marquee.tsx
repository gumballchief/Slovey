"use client";

/**
 * Infinite tool-name marquee (spec #12): a duplicated strip translated 0 → -50%
 * (24s linear, CSS), with edge fade via mask-image. Pauses under reduced-motion
 * (the .cb-marquee-track animation is disabled globally).
 */
const TOOLS = ["GitHub", "Slack", "Notion", "Jira", "Confluence", "Linear", "VS Code", "Cursor", "Claude Code", "Codex", "Gemini CLI", "MCP"];

export function Marquee() {
  const strip = [...TOOLS, ...TOOLS];
  return (
    <div style={{ position: "relative", zIndex: 1, maxWidth: 1180, margin: "70px auto 0", padding: "0 24px" }}>
      <div style={{ textAlign: "center", fontFamily: "var(--font-mono), monospace", fontSize: 11.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "#8b86a0", marginBottom: 18 }}>
        Connects to the tools your team already uses
      </div>
      <div
        style={{
          overflow: "hidden",
          maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
        }}
      >
        <div className="cb-marquee-track" style={{ display: "flex", gap: 44, width: "max-content", animation: "cbMarqueeX 26s linear infinite", willChange: "transform" }}>
          {strip.map((t, i) => (
            <span key={i} style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 20, fontWeight: 600, color: "#9aa0b8", whiteSpace: "nowrap" }}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
