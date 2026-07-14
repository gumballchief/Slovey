"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { GITHUB_APP_INSTALL_URL } from "@/lib/github-app";
import { AnimatedHeadline } from "./AnimatedHeadline";
import { Magnetic } from "./motion";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Hero section — headline pop-in gated on the intro loader, magnetic CTAs. */
export function Hero({ introDone }: { introDone: boolean }) {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  // badge/subhead/CTAs rise in after the headline starts
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 22 },
          animate: introDone ? { opacity: 1, y: 0 } : {},
          transition: { duration: 0.7, ease: EASE, delay },
        };

  return (
    <section ref={sectionRef} id="top" style={{ position: "relative", zIndex: 1, maxWidth: 1180, margin: "0 auto", padding: "clamp(120px, 15vh, 158px) 24px 0", textAlign: "center" }}>
      <motion.div {...rise(0.1)} style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "7px 15px", borderRadius: 99, background: "var(--l-card-strong)", border: "1px solid var(--l-border)", marginBottom: 30 }}>
        <span className="cb-dot-pulse" style={{ width: 7, height: 7, borderRadius: 99, background: "#4f7ef7" }} />
        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--l-body)" }}>Engineering Intelligence Platform</span>
      </motion.div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <AnimatedHeadline text="The intelligence layer beneath your AI coding agents" start={introDone} />
      </div>

      <motion.p {...rise(0.35)} style={{ margin: "28px auto 0", maxWidth: 640, fontFamily: "var(--font-serif), Georgia, serif", fontSize: 20, lineHeight: 1.62, color: "var(--l-body)" }}>
        AI writes great code — it just doesn&apos;t know your company. Slovey gives it your context: your codebase, decisions, and history, so mistakes are caught <em style={{ color: "var(--l-ink)", fontStyle: "italic" }}>before</em> code is ever committed.
      </motion.p>

      <motion.div {...rise(0.5)} style={{ marginTop: 38, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
        <Magnetic>
          <a href="/login" className="cb-cta" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 26px", borderRadius: 12, fontWeight: 500, fontSize: 15, color: "var(--l-btn-text)", textDecoration: "none", background: "var(--l-btn)", transition: "background .2s ease, filter .2s ease" }}>
            Start free <span className="cb-cta-arrow" aria-hidden>→</span>
          </a>
        </Magnetic>
        <a href="#workflow" style={{ display: "inline-flex", alignItems: "center", padding: "14px 24px", borderRadius: 12, fontWeight: 500, fontSize: 15, color: "var(--l-ink)", textDecoration: "none", background: "var(--l-card-strong)", border: "1px solid var(--l-border)" }}>
          See how it works
        </a>
      </motion.div>

      <motion.div {...rise(0.62)} style={{ marginTop: 20, marginBottom: 20, fontFamily: "var(--font-mono), monospace", fontSize: 12.5, letterSpacing: "0.04em", color: "var(--l-muted)" }}>
        No credit card · <a href={GITHUB_APP_INSTALL_URL} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>Connect a repo in minutes</a>
      </motion.div>
    </section>
  );
}
