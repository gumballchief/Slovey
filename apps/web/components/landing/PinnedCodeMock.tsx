"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";

type Line = { t: string; k: "comment" | "removed" | "added" | "blank" };
const LINES: Line[] = [
  { t: "// PaymentService.ts", k: "comment" },
  { t: "- retryPayment(order, { legacy: true })", k: "removed" },
  { t: "+ await paymentGateway.charge(order)", k: "added" },
  { t: "// uses deprecated retry path", k: "comment" },
  { t: "", k: "blank" },
  { t: "// checkout.handler.ts", k: "comment" },
  { t: "+ emitEvent('order.placed', order.id)", k: "added" },
];
const REVIEWS = [
  { icon: "✓", color: "#3ddc84", text: "Build passes" },
  { icon: "✓", color: "#3ddc84", text: "142 tests green" },
  { icon: "⚠", color: "#ffb454", text: "New event 'order.placed' lacks a schema" },
  { icon: "✕", color: "#ff6b81", text: "Reintroduces a deprecated retry path" },
];
const TOTAL = LINES.reduce((n, l) => n + l.t.length, 0);
// char offset where each line begins in the global type stream
const OFFSETS = LINES.reduce<number[]>((acc, l, i) => { acc[i] = (acc[i - 1] ?? 0) + (LINES[i - 1]?.t.length ?? 0); return acc; }, []);

function lineStyle(k: Line["k"]): React.CSSProperties {
  if (k === "comment") return { color: "#6f7492" };
  if (k === "removed") return { color: "#8b9bc4", background: "rgba(120,150,210,.12)" };
  if (k === "added") return { color: "#6ea8ff", background: "rgba(90,150,255,.14)" };
  return {};
}

/**
 * The hero's code mock, promoted to a pinned scroll-through (the "first" one):
 * the panel sticks to the viewport while the diff TYPES OUT driven by scroll —
 * you stop and watch it happen — then the review verdict lands and it blocks the
 * commit. Reduced-motion / narrow: a static, fully-typed panel (no pin).
 */
export function PinnedCodeMock() {
  const reduce = useReducedMotion();
  const outerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: outerRef, offset: ["start start", "end end"] });
  const [typed, setTyped] = useState(0); // 0..TOTAL chars revealed
  const [reviewP, setReviewP] = useState(0); // 0..1 review reveal

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    // First 68% of the scroll types the diff; last 24% reveals the review.
    setTyped(Math.round(Math.min(1, v / 0.68) * TOTAL));
    setReviewP(Math.max(0, Math.min(1, (v - 0.72) / 0.24)));
  });

  const done = reduce ? true : typed >= TOTAL;
  const showTyped = reduce ? TOTAL : typed;
  const showReview = reduce ? 1 : reviewP;
  // which line the caret is on
  let caretLine = -1;
  if (!reduce && !done) {
    for (let i = 0; i < LINES.length; i++) {
      if (showTyped >= OFFSETS[i]! && showTyped <= OFFSETS[i]! + LINES[i]!.t.length) caretLine = i;
    }
  }

  const Panel = (
    <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(20,30,55,.5)", background: "#0e1220", boxShadow: "0 40px 90px -40px rgba(30,30,60,.55)", maxWidth: 940, margin: "0 auto", fontFamily: "var(--font-mono), monospace" }} data-mock-grid>
      {/* code panel */}
      <div style={{ padding: "0 0 18px", position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 16px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
          <span style={{ width: 11, height: 11, borderRadius: 99, background: "#ff5f57" }} />
          <span style={{ width: 11, height: 11, borderRadius: 99, background: "#febc2e" }} />
          <span style={{ width: 11, height: 11, borderRadius: 99, background: "#28c840" }} />
          <span style={{ marginLeft: 10, fontSize: 12, color: "#8890a6" }}>pull-request #482 · feat/checkout-refactor</span>
        </div>
        <div style={{ padding: "16px 18px", fontSize: 13, lineHeight: 1.85, position: "relative" }}>
          {LINES.map((line, i) => {
            const chars = Math.max(0, Math.min(line.t.length, showTyped - OFFSETS[i]!));
            return (
              <div key={i} style={{ ...lineStyle(line.k), borderRadius: 5, padding: line.k === "blank" ? "0" : "1px 8px", minHeight: line.k === "blank" ? 14 : undefined, whiteSpace: "pre" }}>
                {line.t.slice(0, chars)}
                {caretLine === i && <span className="cb-caret">▋</span>}
              </div>
            );
          })}
        </div>
      </div>
      {/* review panel */}
      <div style={{ padding: "16px 18px", borderLeft: "1px solid rgba(255,255,255,.06)", background: "#0b0f1a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ width: 20, height: 20, borderRadius: 6, background: "linear-gradient(135deg,#4f7ef7,#7c5cff)", display: "inline-block" }} />
          <span style={{ fontFamily: "var(--font-inter-tight), sans-serif", fontSize: 14, fontWeight: 600, color: "#e6ebf7" }}>Slovey review</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {REVIEWS.map((r, i) => {
            const on = showReview >= (i + 1) / (REVIEWS.length + 1);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-inter-tight), sans-serif", fontSize: 13.5, color: "#cbd3e6", opacity: on ? 1 : 0, transform: on ? "none" : "translateY(8px)", transition: "opacity .4s ease, transform .5s cubic-bezier(.16,1,.3,1)" }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, display: "grid", placeItems: "center", color: r.color, fontSize: 12, background: `${r.color}1f`, filter: `drop-shadow(0 0 6px ${r.color})` }}>{r.icon}</span>
                {r.text}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 16, padding: "10px 12px", borderRadius: 10, background: "rgba(255,109,129,.08)", border: "1px solid rgba(255,109,129,.28)", color: "#ff9cae", fontFamily: "var(--font-inter-tight), sans-serif", fontSize: 13, fontWeight: 600, boxShadow: "0 0 22px -6px rgba(255,109,129,.5)", opacity: showReview >= 0.99 ? 1 : 0, transform: showReview >= 0.99 ? "none" : "translateY(8px)", transition: "opacity .45s ease, transform .5s cubic-bezier(.16,1,.3,1)" }}>
          ✕ Blocked before commit
        </div>
      </div>
    </div>
  );

  if (reduce) {
    return (
      <section id="preview" style={{ position: "relative", zIndex: 1, maxWidth: 1180, margin: "0 auto", padding: "clamp(56px, 7vh, 84px) 24px 0" }}>{Panel}</section>
    );
  }

  return (
    <section id="preview">
      <div ref={outerRef} style={{ position: "relative", height: "260vh" }}>
        <div style={{ position: "sticky", top: 0, minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 0" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px", width: "100%" }}>
            <div style={{ textAlign: "center", marginBottom: 34 }}>
              <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#7fb0f2" }}>01 — Live review</div>
              <h2 style={{ fontFamily: "var(--font-display), sans-serif", fontWeight: 600, fontSize: "clamp(26px,3.6vw,40px)", lineHeight: 1.12, letterSpacing: "-0.025em", color: "var(--l-ink)", margin: "12px 0 0", paddingBottom: "0.08em" }}>Watch it catch a mistake, live</h2>
            </div>
            {Panel}
          </div>
        </div>
      </div>
    </section>
  );
}
