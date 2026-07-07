"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AnimatedHeadline } from "./AnimatedHeadline";
import { CodeMock } from "./CodeMock";
import { Magnetic } from "./motion";

const GITHUB_APP_INSTALL = "https://github.com/apps/company-brain/installations/new";
const EASE = [0.16, 1, 0.3, 1] as const;

/** Hero section — headline pop-in gated on the intro loader, magnetic CTAs, code mock. */
export function Hero({ introDone }: { introDone: boolean }) {
  const reduce = useReducedMotion();
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
    <section id="top" style={{ position: "relative", zIndex: 1, maxWidth: 1180, margin: "0 auto", padding: "150px 24px 0", textAlign: "center" }}>
      <motion.div {...rise(0.1)} style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "7px 15px", borderRadius: 99, background: "rgba(255,255,255,.7)", border: "1px solid #e3e9f5", backdropFilter: "blur(8px)", marginBottom: 30 }}>
        <span className="cb-dot-pulse" style={{ width: 7, height: 7, borderRadius: 99, background: "#4f7ef7" }} />
        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#565163" }}>Engineering Intelligence Platform</span>
      </motion.div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <AnimatedHeadline text="The intelligence layer beneath your AI coding agents" start={introDone} />
      </div>

      <motion.p {...rise(0.35)} style={{ margin: "26px auto 0", maxWidth: 620, fontSize: 18, lineHeight: 1.6, color: "#565163" }}>
        AI writes great code — it just doesn&apos;t know your company. Company Brain gives it your context: your codebase, decisions, and history, so mistakes are caught <strong style={{ color: "#1b1726", fontWeight: 600 }}>before</strong> code is ever committed.
      </motion.p>

      <motion.div {...rise(0.5)} style={{ marginTop: 38, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
        <Magnetic>
          <a href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 26px", borderRadius: 12, fontWeight: 600, fontSize: 15, color: "#fbfaff", textDecoration: "none", background: "linear-gradient(120deg,#241d33,#463a63)", boxShadow: "0 12px 30px -10px rgba(255,120,100,.6)" }}>
            Start free
          </a>
        </Magnetic>
        <a href="#workflow" style={{ display: "inline-flex", alignItems: "center", padding: "14px 24px", borderRadius: 12, fontWeight: 500, fontSize: 15, color: "#1b1726", textDecoration: "none", background: "#fff", border: "1px solid #e3e9f5" }}>
          See how it works
        </a>
      </motion.div>

      <motion.div {...rise(0.62)} style={{ marginTop: 20, fontFamily: "var(--font-mono), monospace", fontSize: 12.5, letterSpacing: "0.04em", color: "#8b86a0" }}>
        No credit card · <a href={GITHUB_APP_INSTALL} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>Connect a repo in minutes</a>
      </motion.div>

      <motion.div {...rise(0.8)} style={{ marginTop: 70 }}>
        <CodeMock />
      </motion.div>
    </section>
  );
}
