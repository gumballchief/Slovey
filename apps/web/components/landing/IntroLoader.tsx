"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const COUNT_MS = 1500; // 0 → 100 duration
const HOLD_MS = 240; // pause at 100 before the fade
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

/**
 * Full-screen intro loader (spec #1): a gradient number counts 0→100, locks
 * scroll while active, then fades out and calls onDone.
 *
 * Resilience is the whole point of the rewrite: the count is driven by
 * wall-clock elapsed time (not per-frame increments), and a hard setTimeout
 * safety net force-completes the loader even if requestAnimationFrame is
 * throttled or paused (background tabs, battery saver, heavy mobile pages) —
 * so the overlay can never permanently cover the page or leave scroll locked.
 * Tap / scroll / key also skips. Reduced-motion: skips entirely.
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

    const start = performance.now();
    let raf = 0;
    let finished = false;

    // Single idempotent exit: unlock scroll, start the fade, release the hero.
    // Called from whichever fires first — the rAF completion or the safety net.
    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      clearTimeout(safety);
      setPct(100);
      document.body.style.overflow = prevOverflow;
      setGone(true); // triggers the AnimatePresence exit fade
      onDone(); // release the hero letter pop-in
    };

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      setPct(Math.round(easeOutExpo(t) * 100));
      if (t >= 1) {
        setTimeout(finish, HOLD_MS);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Hard safety net — setTimeout still fires in throttled/background tabs even
    // when rAF is paused, guaranteeing the page is never left bricked.
    const safety = setTimeout(finish, COUNT_MS + HOLD_MS + 500);

    // Returning to a backgrounded tab: snap to the correct value / finish.
    const onVis = () => {
      if (finished || document.hidden) return;
      if (performance.now() - start >= COUNT_MS) finish();
      else {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
      }
    };
    // Manual escape hatch.
    const skip = () => finish();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);
    window.addEventListener("wheel", skip, { passive: true });
    window.addEventListener("touchstart", skip, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(safety);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchstart", skip);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  if (reduce) return null;

  return (
    <AnimatePresence>
      {!gone && (
        <motion.div
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "var(--l-loader-bg)",
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
              background: "linear-gradient(120deg, var(--l-ink) 0%, #4f7ef7 90%)",
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
              color: "var(--l-muted)",
            }}
          >
            Loading engineering memory
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
