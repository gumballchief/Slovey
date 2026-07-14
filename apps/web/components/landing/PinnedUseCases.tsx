"use client";

import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import { MaskReveal } from "./motion";

const EASE = [0.16, 1, 0.3, 1] as const;

type UseCase = { no: string; tag: string; title: string; body: string };
const CASES: UseCase[] = [
  { no: "01", tag: "Onboarding", title: "Ramp new engineers in days", body: "New hires ask Slovey instead of interrupting seniors — every past decision, convention, and gotcha is queryable from day one." },
  { no: "02", tag: "Autonomy", title: "Safe autonomy for agents", body: "Let coding agents run further without babysitting — the gate catches anything that breaks a rule or reintroduces a rejected approach before it commits." },
  { no: "03", tag: "Knowledge", title: "Preserve hard-won decisions", body: "When someone leaves, their reasoning stays. Every “why we did it this way” is captured with the PR and incident that shaped it." },
  { no: "04", tag: "Reliability", title: "Stop repeat incidents", body: "The pattern that caused last quarter's outage is blocked automatically — the incident becomes a rule nobody has to remember." },
];

function Heading() {
  return (
    <div style={{ textAlign: "center", marginBottom: 40 }}>
      <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--l-muted2)" }}>06 — Use cases</div>
      <MaskReveal style={{ marginTop: 14 }}>
        <h2 style={{ fontFamily: "var(--font-display), sans-serif", fontWeight: 600, fontSize: "clamp(30px,4.4vw,50px)", lineHeight: 1.12, letterSpacing: "-0.025em", color: "var(--l-ink)", margin: 0, paddingBottom: "0.08em" }}>Put your engineering memory to work</h2>
      </MaskReveal>
    </div>
  );
}

function Card({ c, i, open, done, active, reduce }: { c: UseCase; i: number; open: boolean; done: boolean; active: number; reduce: boolean }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: `1px solid ${open ? "#c9d6f7" : "var(--l-border)"}`,
        background: open ? "var(--l-card-strong)" : "var(--l-card-faint)",
        padding: "22px 26px",
        transition: "border-color .45s cubic-bezier(.16,1,.3,1), background-color .45s cubic-bezier(.16,1,.3,1), box-shadow .45s cubic-bezier(.16,1,.3,1), opacity .45s cubic-bezier(.16,1,.3,1), transform .45s cubic-bezier(.16,1,.3,1)",
        boxShadow: open ? "0 24px 60px -34px rgba(50,60,120,.4)" : "none",
        opacity: !reduce && !open && !done && i > active ? 0.62 : 1,
        transform: open ? "scale(1)" : "scale(.985)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 13, color: open || done ? "var(--l-ink)" : "var(--l-muted)", transition: "color .3s" }}>{c.no}</span>
        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: open ? "#7c5cff" : "var(--l-muted)", background: open ? "rgba(124,92,255,.1)" : "transparent", padding: open ? "3px 8px" : 0, borderRadius: 6, transition: "color .3s, background-color .3s, padding .3s, box-shadow .3s", boxShadow: open ? "0 0 14px rgba(124,92,255,.35)" : "none" }}>{c.tag}</span>
        <h3 style={{ margin: 0, fontFamily: "var(--font-display), sans-serif", fontSize: 21, fontWeight: 600, letterSpacing: "-0.015em", color: open || done ? "var(--l-ink)" : "var(--l-body)", transition: "color .3s" }}>{c.title}</h3>
      </div>
      <div style={{ overflow: "hidden", maxHeight: reduce || open ? 220 : 0, opacity: reduce || open ? 1 : 0, transition: "max-height .6s cubic-bezier(.16,1,.3,1), opacity .5s ease" }}>
        <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.6, color: "var(--l-body)", maxWidth: 620 }}>{c.body}</p>
      </div>
    </div>
  );
}

/**
 * Router: the pinned variant owns the scroll target ref, so `useScroll` is only
 * ever called when its element is rendered — never against an unhydrated ref.
 */
export function PinnedUseCases() {
  const reduce = useReducedMotion();
  // Pin on every viewport; only reduced-motion falls back to the open list.
  if (reduce) return <UseCasesStacked />;
  return <UseCasesPinned />;
}

// Reduced-motion / narrow-viewport (<760px): every card open.
function UseCasesStacked() {
  return (
    <section id="usecases" style={{ position: "relative", zIndex: 1, maxWidth: 860, margin: "0 auto", padding: "clamp(88px, 10vh, 132px) 24px 0" }}>
      <Heading />
      <div style={{ display: "grid", gap: 14 }}>
        {CASES.map((c, i) => (
          <Card key={c.no} c={c} i={i} open done active={CASES.length} reduce />
        ))}
      </div>
    </section>
  );
}

// Pinned reveal — sticky inner, scroll opens each card in turn.
function UseCasesPinned() {
  const outerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: outerRef, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(Math.min(CASES.length - 1, Math.max(0, Math.floor(v * CASES.length * 0.999))));
  });

  return (
    <section id="usecases">
      <div ref={outerRef} style={{ position: "relative", height: "340vh" }}>
        <div style={{ position: "sticky", top: 0, minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 0" }}>
          <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 24px", width: "100%" }}>
            <Heading />
            <motion.div style={{ display: "grid", gap: 14 }}>
              {CASES.map((c, i) => (
                <motion.div key={c.no} animate={{ y: i === active ? -2 : 0 }} transition={{ duration: 0.4, ease: EASE }}>
                  <Card c={c} i={i} open={i === active} done={i < active} active={active} reduce={false} />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
