"use client";

import { Magnetic } from "./motion";

/**
 * Closing CTA — a real React component (was innerHTML from the design tool: a
 * glossy gradient card that hardcoded a near-white stop, so it turned into a grey
 * slab in dark mode, with a leftover coral glow on the button). Now a calm,
 * theme-aware framed panel: serif heading, muted deck, solid-ink + outline CTAs.
 */
export function CtaSection() {
  return (
    <section id="cta" style={{ position: "relative", zIndex: 1, maxWidth: 1180, margin: "0 auto", padding: "clamp(88px, 10vh, 132px) 24px 0" }}>
      <div
        style={{
          maxWidth: 780,
          margin: "0 auto",
          textAlign: "center",
          background: "var(--l-card)",
          border: "1px solid var(--l-border)",
          borderRadius: 28,
          padding: "clamp(48px, 7vw, 82px) 32px",
        }}
      >
        <h2 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontWeight: 500, fontSize: "clamp(30px,4.6vw,52px)", lineHeight: 1.08, letterSpacing: "-0.02em", margin: 0, color: "var(--l-ink)" }}>
          Give your AI the context it&apos;s been missing
        </h2>
        <p style={{ margin: "20px auto 0", maxWidth: 500, fontFamily: "var(--font-serif), Georgia, serif", fontSize: 19, lineHeight: 1.6, color: "var(--l-body)" }}>
          Connect a repository and watch Slovey start catching what your review process misses.
        </p>
        <div style={{ marginTop: 36, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Magnetic>
            <a href="/login" className="cb-cta" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 26px", borderRadius: 12, fontWeight: 500, fontSize: 15, color: "var(--l-btn-text)", textDecoration: "none", background: "var(--l-btn)", transition: "background .2s ease, filter .2s ease" }}>
              Start free <span className="cb-cta-arrow" aria-hidden>→</span>
            </a>
          </Magnetic>
          <a href="/demo" style={{ display: "inline-flex", alignItems: "center", padding: "13px 24px", borderRadius: 12, fontWeight: 500, fontSize: 15, color: "var(--l-ink)", textDecoration: "none", background: "transparent", border: "1px solid var(--l-border)", transition: "border-color .2s ease, color .2s ease" }}>
            Book a demo
          </a>
        </div>
      </div>
    </section>
  );
}
