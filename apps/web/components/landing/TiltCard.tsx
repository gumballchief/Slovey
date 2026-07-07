"use client";

import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";

/**
 * 3D tilt card (spec #7): tilts toward the cursor (rotateX ±10°, rotateY ±12°) with
 * a cursor-tracked radial glare; children can sit on depth planes via translateZ.
 * Springs back flat on leave. Reduced-motion: a plain card, no tilt/glare.
 */
export function TiltCard({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5); // 0..1 pointer position
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 180, damping: 18 });
  const sy = useSpring(py, { stiffness: 180, damping: 18 });
  const rotateY = useTransform(sx, [0, 1], [-12, 12]);
  const rotateX = useTransform(sy, [0, 1], [10, -10]);
  const glare = useTransform([sx, sy], ([x, y]: number[]) => `radial-gradient(240px circle at ${x! * 100}% ${y! * 100}%, rgba(255,255,255,.35), transparent 60%)`);

  if (reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <div style={{ perspective: 1000 }}>
      <motion.div
        ref={ref}
        className={className}
        onPointerMove={(e) => {
          const r = ref.current!.getBoundingClientRect();
          px.set((e.clientX - r.left) / r.width);
          py.set((e.clientY - r.top) / r.height);
        }}
        onPointerLeave={() => {
          px.set(0.5);
          py.set(0.5);
        }}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d", willChange: "transform", position: "relative", ...style }}
      >
        {children}
        <motion.div
          aria-hidden
          style={{ position: "absolute", inset: 0, borderRadius: "inherit", background: glare, pointerEvents: "none", mixBlendMode: "soft-light" }}
        />
      </motion.div>
    </div>
  );
}
