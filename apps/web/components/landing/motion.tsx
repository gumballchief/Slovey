"use client";

import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

/** Standard brand easing — easeOutExpo. */
export const EASE = [0.16, 1, 0.3, 1] as const;

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
      initial={{ opacity: 0, y, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 1.1, ease: EASE, delay }}
    >
      {children}
    </motion.div>
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
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
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
        hidden: { opacity: 0, y, filter: "blur(8px)" },
        show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 1.0, ease: EASE } },
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
      className={className}
      style={{ x: sx, y: sy, display: "inline-flex", willChange: "transform", ...style }}
      onPointerMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * strengthX);
        y.set((e.clientY - r.top - r.height / 2) * strengthY);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
