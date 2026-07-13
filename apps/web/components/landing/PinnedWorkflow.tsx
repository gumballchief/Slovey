"use client";

import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import { MaskReveal } from "./motion";

const EASE = [0.16, 1, 0.3, 1] as const;

type Step = { no: string; title: string; body: string; term: string; ok: boolean };
const STEPS: Step[] = [
  { no: "01", title: "Checks build errors", body: "Typecheck and compile run first — broken code never reaches review.", term: "$ tsc --noEmit → 0 errors", ok: true },
  { no: "02", title: "Runs the tests", body: "The full suite executes in the background; green before anything merges.", term: "$ vitest run → 142 passed", ok: true },
  { no: "03", title: "Detects architecture violations", body: "Layering, boundaries, forbidden imports — flagged with the rule that made them.", term: "✗ import 'db' from ui/ — layer violation", ok: false },
  { no: "04", title: "Verifies company rules", body: "Every convention you've encoded is enforced on the diff, automatically.", term: "✓ 6 conventions checked", ok: true },
  { no: "05", title: "Checks prior decisions", body: "The change is matched against your decision graph — nothing rejected is reintroduced.", term: "✗ reintroduces retry path (DEC-17)", ok: false },
  { no: "06", title: "Blocks deprecated patterns", body: "Deprecated APIs and retired approaches are blocked, citing the incident behind the rule.", term: "✗ legacy:true — removed in PR #482", ok: false },
];

function Heading() {
  return (
    <div style={{ textAlign: "center", marginBottom: 8 }}>
      <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#7fb0f2" }}>04 — Pipeline</div>
      <MaskReveal style={{ marginTop: 14 }}>
        <h2 style={{ fontFamily: "var(--font-display), sans-serif", fontWeight: 600, fontSize: "clamp(30px,4.4vw,50px)", lineHeight: 1.12, letterSpacing: "-0.025em", color: "var(--l-ink)", margin: 0, paddingBottom: "0.08em" }}>What happens on every change</h2>
      </MaskReveal>
    </div>
  );
}

/**
 * Router: pick the pinned scrollytelling or the stacked fallback. The pinned
 * variant owns the scroll target ref, so `useScroll` is only ever called when
 * that element is actually rendered — never against an unhydrated ref.
 */
export function PinnedWorkflow() {
  const reduce = useReducedMotion();
  // Pin on every viewport (the responsive grid collapses to one column on
  // narrow screens); only reduced-motion gets the plain stacked list.
  if (reduce) return <WorkflowStacked />;
  return <WorkflowPinned />;
}

// Reduced-motion / narrow-viewport (<760px): a normal stacked list.
function WorkflowStacked() {
  return (
    <section id="workflow" style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "0 auto", padding: "130px 24px 0" }}>
      <Heading />
      <div style={{ marginTop: 40, display: "grid", gap: 16 }}>
        {STEPS.map((s) => (
          <div key={s.no} style={{ display: "flex", gap: 16, padding: 20, borderRadius: 16, border: "1px solid var(--l-border)", background: "var(--l-card)" }}>
            <div style={{ fontFamily: "var(--font-mono), monospace", color: "#4f7ef7", fontSize: 13 }}>{s.no}</div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontFamily: "var(--font-display), sans-serif", color: "var(--l-ink)" }}>{s.title}</h3>
              <p style={{ margin: "6px 0 0", fontSize: 14.5, color: "var(--l-body)" }}>{s.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Pinned stepper — sticky inner, scroll drives the active step.
function WorkflowPinned() {
  const outerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: outerRef, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length * 0.999))));
  });
  // progress line reaches the active dot's center (stepped, .4s).
  const railH = `${((active + 0.5) / STEPS.length) * 100}%`;

  return (
    <section id="workflow">
      <div ref={outerRef} style={{ position: "relative", height: `${STEPS.length * 70}vh` }}>
        <div style={{ position: "sticky", top: 0, height: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden" }}>
          <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px", width: "100%" }}>
            <Heading />
            <div style={{ marginTop: 44, display: "grid", gridTemplateColumns: "minmax(0,340px) 1fr", gap: 48, alignItems: "center" }} data-flow>
              {/* left rail */}
              <div style={{ position: "relative", paddingLeft: 26 }}>
                <div style={{ position: "absolute", left: 5, top: 6, bottom: 6, width: 2, background: "var(--l-border)", borderRadius: 2 }} />
                <div style={{ position: "absolute", left: 5, top: 6, width: 2, height: railH, background: "linear-gradient(#4f7ef7,#7c5cff)", borderRadius: 2, transition: "height .4s cubic-bezier(.16,1,.3,1)" }} />
                {STEPS.map((s, i) => {
                  const reached = i <= active;
                  return (
                    <div key={s.no} style={{ position: "relative", padding: "13px 0" }}>
                      <span style={{ position: "absolute", left: -26, top: 18, width: 12, height: 12, borderRadius: 99, background: reached ? "#4f7ef7" : "#fff", border: `2px solid ${reached ? "#4f7ef7" : "var(--l-border)"}`, transition: "background-color .3s, border-color .3s, transform .3s, box-shadow .3s", transform: i === active ? "scale(1.25)" : "scale(1)", boxShadow: i === active ? "0 0 0 5px rgba(79,126,247,.15)" : "none" }} />
                      <div style={{ fontFamily: "var(--font-inter-tight), sans-serif", fontSize: 15.5, fontWeight: i === active ? 600 : 500, color: reached ? "var(--l-ink)" : "var(--l-muted)", transition: "color .3s" }}>{s.title}</div>
                    </div>
                  );
                })}
              </div>
              {/* right stage */}
              <div style={{ position: "relative", minHeight: 300 }}>
                {STEPS.map((s, i) => (
                  <motion.div
                    key={s.no}
                    initial={false}
                    animate={{ opacity: i === active ? 1 : 0, y: i === active ? 0 : 18, pointerEvents: i === active ? "auto" : "none" }}
                    transition={{ duration: 0.5, ease: EASE }}
                    style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}
                  >
                    <div style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 64, fontWeight: 700, color: "#e6ecfb", lineHeight: 1 }}>{s.no}</div>
                    <h3 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--l-ink)", margin: "8px 0 0" }}>{s.title}</h3>
                    <p style={{ fontSize: 17, lineHeight: 1.6, color: "var(--l-body)", margin: "12px 0 0", maxWidth: 460 }}>{s.body}</p>
                    <div style={{ marginTop: 20, display: "inline-flex", alignSelf: "flex-start", fontFamily: "var(--font-mono), monospace", fontSize: 13, color: s.ok ? "#6ea8ff" : "#ff9cae", background: "#0e1220", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,.08)" }}>{s.term}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
