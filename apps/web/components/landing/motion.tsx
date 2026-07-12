"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

/** Standard brand easing — easeOutExpo. */
export const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * True once the viewport is at least `px` wide. Used to gate the heavy
 * pinned/letter-split effects to >=760px (mobile gets the stacked/plain layout).
 * SSR-safe: starts false, resolves on mount.
 */
export function useMinWidth(px: number) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width:${px}px)`);
    const update = () => setOk(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [px]);
  return ok;
}

/**
 * Blur-up entrance: opacity 0 + translateY(46px) + blur(8px) -> in, once, on first
 * view. Reduced-motion renders it in its final state immediately.
 */
export function Reveal({
  children,
  delay = 0,
  y = 46,
  className,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 1.1, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Masked line reveal (sui.io-style): the text rises from behind an
 * overflow-hidden mask — no fade, no blur, just weight. Use on section
 * headlines. Compositor-only (transform on the inner span).
 */
export function MaskReveal({
  children,
  delay = 0,
  className,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <div className={className} style={{ overflow: "hidden", ...style }}>
      <motion.div
        initial={{ y: "110%" }}
        whileInView={{ y: "0%" }}
        viewport={{ once: true, amount: 0.3, margin: "0px 0px -8% 0px" }}
        transition={{ duration: 0.9, ease: EASE, delay }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/** Container that staggers its direct Reveal children ~85ms apart. */
export function RevealGroup({
  children,
  className,
  stagger = 0.085,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.12, margin: "0px 0px -8% 0px" }}
      variants={{ show: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  );
}

/** A Reveal item for use inside RevealGroup (variant-driven). */
export function RevealItem({
  children,
  className,
  y = 40,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  y?: number;
  style?: React.CSSProperties;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className} style={style}>{children}</div>;
  return (
    <motion.div
      className={className}
      style={style}
      variants={{
        hidden: { opacity: 0, y },
        show: { opacity: 1, y: 0, transition: { duration: 1.1, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Magnetic wrapper: pulls toward the cursor on pointermove (translate ~0.3x/0.4y of
 * the offset from center), springs back on leave. Reduced-motion: no motion.
 */
export function Magnetic({
  children,
  className,
  strengthX = 0.3,
  strengthY = 0.4,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  strengthX?: number;
  strengthY?: number;
  style?: React.CSSProperties;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  // Rect is read ONCE per hover (on enter) and reused for every move; moves are
  // processed at most once per frame to keep pointermove off the layout path.
  const rect = useRef<DOMRect | null>(null);
  const raf = useRef(0);
  const last = useRef({ x: 0, y: 0 });
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });
  if (reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      ref={ref}
      className={className ? `cb-mag ${className}` : "cb-mag"}
      style={{ x: sx, y: sy, display: "inline-flex", willChange: "transform", ...style }}
      onPointerEnter={() => {
        rect.current = ref.current!.getBoundingClientRect();
      }}
      onPointerMove={(e) => {
        last.current = { x: e.clientX, y: e.clientY };
        if (raf.current) return;
        raf.current = requestAnimationFrame(() => {
          raf.current = 0;
          const r = rect.current;
          if (!r) return;
          x.set((last.current.x - r.left - r.width / 2) * strengthX);
          y.set((last.current.y - r.top - r.height / 2) * strengthY);
        });
      }}
      onPointerLeave={() => {
        rect.current = null;
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
