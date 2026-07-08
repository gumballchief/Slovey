"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useMinWidth } from "./motion";

// spec #4: ink → accent → ink with a light accent-2 band, swept via background-position.
const GRAD = "linear-gradient(100deg,#1b1726,#3a3350 20%,#4f7ef7 46%,#2a2440 62%,#7fb0f2 86%,#1b1726 100%)";

/**
 * Hero H1 split into per-letter spans (words kept unbreakable). Each letter pops in
 * (translateY(52) scale(.86) opacity:0 → rest, staggered ~26ms, easeOutExpo), carries
 * an ink→accent gradient + slow shimmer, and lifts toward the cursor when within ~100px.
 * Reduced-motion: static, full-opacity, no cursor reaction.
 */
export function AnimatedHeadline({ text, start }: { text: string; start: boolean }) {
  const reduce = useReducedMotion();
  const wide = useMinWidth(760);
  const rootRef = useRef<HTMLHeadingElement>(null);
  const letterRefs = useRef<HTMLSpanElement[]>([]);
  letterRefs.current = [];

  const letterCount = text.replace(/ /g, "").length;
  // Cursor reaction turns on only once the pop-in has finished (spec #5:
  // 90 + letters*26 + 850 ms after the animation starts).
  const [reactive, setReactive] = useState(false);
  useEffect(() => {
    if (reduce || !wide || !start) return;
    const t = setTimeout(() => setReactive(true), 90 + letterCount * 26 + 850);
    return () => clearTimeout(t);
  }, [reduce, wide, start, letterCount]);

  // Cursor proximity lift (manual rAF; applied to the inner span so it composes
  // with the framer-motion pop-in on the outer span).
  useEffect(() => {
    if (reduce || !reactive) return;
    const root = rootRef.current;
    if (!root) return;
    let raf = 0;
    let mx = -9999;
    let my = -9999;
    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const apply = () => {
      raf = 0;
      for (const el of letterRefs.current) {
        const r = el.getBoundingClientRect();
        const dx = mx - (r.left + r.width / 2);
        const dy = my - (r.top + r.height / 2);
        const dist = Math.hypot(dx, dy);
        const f = Math.max(0, 1 - dist / 100);
        el.style.transform = f > 0 ? `translateY(${-20 * f}px) scale(${1 + 0.26 * f})` : "";
      }
    };
    const onLeave = () => {
      for (const el of letterRefs.current) el.style.transform = "";
    };
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [reactive, reduce]);

  const words = text.split(" ");
  let gi = 0; // global letter index for stagger
  // Below 760px (or reduced-motion) the letter split + pop-in are skipped —
  // render the headline plainly, at rest, per the perf gate.
  const plain = reduce || !wide;

  return (
    <h1
      ref={rootRef}
      style={{
        fontFamily: "var(--font-display), sans-serif",
        fontWeight: 600,
        fontSize: "clamp(40px, 6.6vw, 82px)",
        lineHeight: 1.02,
        letterSpacing: "-0.035em",
        margin: 0,
        maxWidth: 900,
      }}
    >
      {words.map((word, wi) => (
        <span key={wi} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
          {word.split("").map((ch) => {
            const i = gi++;
            const inner = (
              <span
                ref={(el) => {
                  if (el) letterRefs.current.push(el);
                }}
                className="cb-shimmer"
                style={{
                  display: "inline-block",
                  backgroundImage: GRAD,
                  backgroundSize: "220% auto",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  transition: "transform .3s cubic-bezier(.2,.85,.25,1)",
                  willChange: "transform",
                }}
              >
                {ch}
              </span>
            );
            return plain ? (
              <span key={i} style={{ display: "inline-block" }}>{inner}</span>
            ) : (
              <motion.span
                key={i}
                style={{ display: "inline-block" }}
                initial={{ y: 52, scale: 0.86, opacity: 0 }}
                animate={start ? { y: 0, scale: 1, opacity: 1 } : {}}
                transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: (90 + i * 26) / 1000 }}
              >
                {inner}
              </motion.span>
            );
          })}
          {wi < words.length - 1 && <span>&nbsp;</span>}
        </span>
      ))}
    </h1>
  );
}
