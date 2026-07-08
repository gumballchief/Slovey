"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * Full-screen intro loader (spec #1): a large gradient number counts 0→100 with a
 * thin fill bar + mono caption, locks scroll while active, then fades out (~700ms)
 * and calls onDone. Reduced-motion: skips entirely (renders nothing, fires onDone).
 */
export function IntroLoader({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();
  const [pct, setPct] = useState(0);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (reduce) {
      onDone();
      setGone(true);
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timers: ReturnType<typeof setTimeout>[] = [];
    let p = 0;
    // Ease-out count: each tick advances by ~10% of the remaining gap (min 1) plus
    // a little jitter; ticks are 26–66ms apart, reaching 100 in ~1.5–2.2s.
    const tick = () => {
      p += Math.max(1, (100 - p) * 0.1) + Math.random() * 1.5;
      if (p >= 100) {
        setPct(100);
        // hold at 100, then fade the overlay, then remove + unlock scroll.
        timers.push(
          setTimeout(() => {
            setGone(true); // begins the .7s exit fade
            timers.push(
              setTimeout(() => {
                document.body.style.overflow = prevOverflow;
                onDone(); // release the hero letter pop-in
              }, 720),
            );
          }, 260),
        );
        return;
      }
      setPct(Math.floor(p));
      timers.push(setTimeout(tick, 26 + Math.random() * 40));
    };
    timers.push(setTimeout(tick, 26 + Math.random() * 40));
    return () => {
      for (const t of timers) clearTimeout(t);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  if (reduce) return null;

  return (
    <AnimatePresence>
      {!gone && (
        <motion.div
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "#f4f2f8",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 22,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display), sans-serif",
              fontWeight: 700,
              fontSize: "clamp(80px, 16vw, 190px)",
              lineHeight: 1,
              letterSpacing: "-0.04em",
              background: "linear-gradient(120deg, #1b1726 0%, #4f7ef7 90%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {pct}
          </div>
          <div style={{ width: "min(280px, 60vw)", height: 3, borderRadius: 3, background: "rgba(79,126,247,.16)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#4f7ef7,#7c5cff)", borderRadius: 3, transition: "width .2s ease" }} />
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#6b6678",
            }}
          >
            Loading engineering memory
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
