"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";

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

function lineStyle(k: Line["k"]): React.CSSProperties {
  if (k === "comment") return { color: "#6f7492" };
  if (k === "removed") return { color: "#8b9bc4", background: "rgba(120,150,210,.12)" };
  if (k === "added") return { color: "#6ea8ff", background: "rgba(90,150,255,.14)" };
  return {};
}

/** Hero code mock (spec #4): typewriter diff on first view, then review rows reveal. */
export function CodeMock() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  // typed[i] = how many chars of LINES[i] are shown; -1 = not started
  const [typed, setTyped] = useState<number[]>(() => LINES.map(() => 0));
  const [done, setDone] = useState(false);
  const [activeLine, setActiveLine] = useState(0);

  useEffect(() => {
    if (reduce) {
      setTyped(LINES.map((l) => l.t.length));
      setDone(true);
      return;
    }
    if (!inView) return;
    let cancelled = false;
    let li = 0;
    let ci = 0;
    const step = () => {
      if (cancelled) return;
      if (li >= LINES.length) {
        setDone(true);
        return;
      }
      const line = LINES[li]!;
      setActiveLine(li);
      if (ci <= line.t.length) {
        setTyped((prev) => {
          const next = [...prev];
          next[li] = ci;
          return next;
        });
        ci++;
        const jitter = 15 + Math.random() * 24;
        setTimeout(step, jitter);
      } else {
        li++;
        ci = 0;
        setTimeout(step, 95); // pause per line break
      }
    };
    const t = setTimeout(step, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [inView, reduce]);

  return (
    <div
      ref={ref}
      style={{
        display: "grid",
        gridTemplateColumns: "1.35fr 1fr",
        borderRadius: 18,
        overflow: "hidden",
        border: "1px solid rgba(20,30,55,.5)",
        background: "#0e1220",
        boxShadow: "0 40px 90px -40px rgba(30,30,60,.55)",
        maxWidth: 940,
        margin: "0 auto",
        fontFamily: "var(--font-mono), monospace",
      }}
      data-mock-grid
    >
      {/* code panel */}
      <div style={{ padding: "0 0 18px", position: "relative", overflow: "hidden" }}>
        {/* scan bar sweeping behind the diff (spec #6) */}
        {!reduce && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: "45%",
              background: "linear-gradient(180deg, transparent, rgba(110,168,255,.5), transparent)",
              opacity: 0.1,
              pointerEvents: "none",
              animation: "cbScanY 5s linear infinite",
            }}
          />
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 16px", borderBottom: "1px solid rgba(255,255,255,.06)", position: "relative" }}>
          <span style={{ width: 11, height: 11, borderRadius: 99, background: "#ff5f57" }} />
          <span style={{ width: 11, height: 11, borderRadius: 99, background: "#febc2e" }} />
          <span style={{ width: 11, height: 11, borderRadius: 99, background: "#28c840" }} />
          <span style={{ marginLeft: 10, fontSize: 12, color: "#8890a6" }}>pull-request #482 · feat/checkout-refactor</span>
        </div>
        <div style={{ padding: "16px 18px", fontSize: 13, lineHeight: 1.85, position: "relative" }}>
          {LINES.map((line, i) => (
            <div key={i} style={{ ...lineStyle(line.k), borderRadius: 5, padding: line.k === "blank" ? "0" : "1px 8px", minHeight: line.k === "blank" ? 14 : undefined, whiteSpace: "pre" }}>
              {line.t.slice(0, typed[i])}
              {!done && activeLine === i && !reduce && <span className="cb-caret">▋</span>}
            </div>
          ))}
        </div>
      </div>

      {/* review panel */}
      <div style={{ padding: "16px 18px", borderLeft: "1px solid rgba(255,255,255,.06)", background: "#0b0f1a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ width: 20, height: 20, borderRadius: 6, background: "linear-gradient(135deg,#4f7ef7,#7c5cff)", display: "inline-block" }} />
          <span style={{ fontFamily: "var(--font-inter-tight), sans-serif", fontSize: 14, fontWeight: 600, color: "#e6ebf7" }}>Slovey review</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {REVIEWS.map((r, i) => (
            <motion.div
              key={i}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={done || reduce ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.16 + i * 0.15, opacity: { duration: 0.5, ease: "easeOut" }, y: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } }}
              style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-inter-tight), sans-serif", fontSize: 13.5, color: "#cbd3e6" }}
            >
              <span style={{ width: 20, height: 20, borderRadius: 6, display: "grid", placeItems: "center", color: r.color, fontSize: 12, background: `${r.color}1f`, filter: `drop-shadow(0 0 6px ${r.color})` }}>{r.icon}</span>
              {r.text}
            </motion.div>
          ))}
        </div>
        <AnimatePresence>
          {(done || reduce) && (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 0.15 * REVIEWS.length + 0.2, duration: 0.5 }}
              style={{ marginTop: 16, padding: "10px 12px", borderRadius: 10, background: "rgba(255,109,129,.08)", border: "1px solid rgba(255,109,129,.28)", color: "#ff9cae", fontFamily: "var(--font-inter-tight), sans-serif", fontSize: 13, fontWeight: 600, boxShadow: "0 0 22px -6px rgba(255,109,129,.5)" }}
            >
              ✕ Blocked before commit
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
