"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import FAQS from "./faqs.json";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * FAQ — a real React accordion (was innerHTML with hand-wired click handlers
 * that silently failed to attach, so answers never showed). Single-open; the
 * first item starts expanded. Question text uses var(--l-ink) so it stays
 * readable in dark mode (the old markup hardcoded rgb(36,29,51) → invisible).
 */
export function FAQSection() {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" style={{ position: "relative", zIndex: 1, maxWidth: 820, margin: "0 auto", padding: "clamp(88px, 10vh, 132px) 24px 0" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--l-muted2)" }}>08 — FAQ</div>
        <h2 style={{ fontFamily: "var(--font-display), sans-serif", fontWeight: 600, fontSize: "clamp(30px,4.4vw,50px)", lineHeight: 1.1, letterSpacing: "-0.025em", margin: "14px 0 0", color: "var(--l-ink)" }}>
          Questions, answered
        </h2>
      </div>

      <div style={{ marginTop: 40, display: "grid", gap: 12 }}>
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q} style={{ border: "1px solid var(--l-border-soft)", borderRadius: 14, background: "var(--l-card)", overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? -1 : i)}
                aria-expanded={isOpen}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "20px 22px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "var(--l-ink)",
                  fontFamily: "var(--font-inter-tight), sans-serif",
                  fontSize: 16.5,
                  fontWeight: 500,
                }}
              >
                <span>{f.q}</span>
                <span aria-hidden style={{ flexShrink: 0, fontSize: 24, lineHeight: 1, color: "var(--l-muted)", transform: isOpen ? "rotate(45deg)" : "rotate(0deg)", transition: "transform .3s cubic-bezier(.16,1,.3,1)" }}>
                  +
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="a"
                    initial={reduce ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    style={{ overflow: "hidden" }}
                  >
                    <p style={{ margin: 0, padding: "0 22px 22px", color: "var(--l-body)", fontSize: 15, lineHeight: 1.65 }}>{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
