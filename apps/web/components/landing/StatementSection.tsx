"use client";

import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";

// The statement, as tokens. `chip` tokens render as an inline glowing chip.
type Tok = { w: string; chip?: { icon: string; color: string } };
const TOKENS: Tok[] = [
  { w: "Slovey" }, { w: "gives" }, { w: "every" }, { w: "AI" }, { w: "agent" },
  { w: "your company's context", chip: { icon: "M12 3 4 6v5c0 5 3.4 8.3 8 10 4.6-1.7 8-5 8-10V6z", color: "#4f7ef7" } },
  { w: "," }, { w: "enforces" }, { w: "your" }, { w: "standards," }, { w: "remembers" },
  { w: "past decisions", chip: { icon: "M12 8v4l3 2 M12 3a9 9 0 1 0 9 9", color: "#7c5cff" } },
  { w: "," }, { w: "and" }, { w: "stops" }, { w: "mistakes" },
  { w: "before they ship", chip: { icon: "M5 12h14 M13 6l6 6-6 6", color: "#ff6f5e" } },
  { w: "." },
];

export function StatementSection() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.8", "end 0.45"] });
  const [lit, setLit] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setLit(Math.round(v * (TOKENS.length + 3))));

  return (
    <section ref={ref} id="statement" style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "150px 24px 130px", textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#7fb0f2", marginBottom: 30 }}>The idea</div>
      <p style={{ fontFamily: "var(--font-display), sans-serif", fontWeight: 500, fontSize: "clamp(26px, 4vw, 44px)", lineHeight: 1.28, letterSpacing: "-0.02em", margin: 0 }}>
        {TOKENS.map((t, i) => {
          const on = reduce || i < lit;
          if (t.chip) {
            return (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", padding: "2px 12px 2px 10px", margin: "0 4px", borderRadius: 99, border: `1px solid ${on ? t.chip.color : "var(--l-border)"}`, background: on ? `${t.chip.color}12` : "transparent", color: on ? "var(--l-ink)" : "var(--l-word-off)", transition: "color .35s ease, background-color .35s ease, border-color .35s ease", verticalAlign: "middle" }}>
                <motion.svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.chip.color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" animate={{ scale: on ? 1 : 0 }} transition={{ duration: 0.45, ease: [0.2, 1.5, 0.4, 1] }} style={{ boxShadow: on ? "0 0 18px rgba(79,126,247,.7)" : "none", borderRadius: 99 }}>
                  {t.chip.icon.split(" M").map((d, k) => <path key={k} d={(k ? "M" : "") + d} />)}
                </motion.svg>
                {t.w}
              </span>
            );
          }
          return (
            <span key={i} style={{ color: on ? "var(--l-ink)" : "var(--l-word-off)", transition: "color .35s ease" }}>
              {t.w}{t.w.endsWith(",") || t.w === "." || t.w === "," ? "" : " "}
            </span>
          );
        })}
      </p>
    </section>
  );
}
