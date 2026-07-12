"use client";

import { useRef, useState } from "react";
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
  const [hover, setHover] = useState(false);
  // Rect is read once per hover (on enter, re-used every move); moves are
  // coalesced to one per frame so pointermove never touches layout.
  const rect = useRef<DOMRect | null>(null);
  const raf = useRef(0);
  const last = useRef({ x: 0, y: 0 });
  const px = useMotionValue(0.5); // 0..1 pointer position
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 180, damping: 18 });
  const sy = useSpring(py, { stiffness: 180, damping: 18 });
  // spec #10: rotateY = (px-.5)*12  → ±6°,  rotateX = (py-.5)*-10 → ±5°.
  const rotateY = useTransform(sx, [0, 1], [-6, 6]);
  const rotateX = useTransform(sy, [0, 1], [5, -5]);
  const glare = useTransform([sx, sy], ([x, y]: number[]) => `radial-gradient(240px circle at ${x! * 100}% ${y! * 100}%, rgba(28,20,45,.12), transparent 60%)`);

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
        onPointerEnter={() => {
          rect.current = ref.current!.getBoundingClientRect();
          setHover(true);
        }}
        onPointerMove={(e) => {
          last.current = { x: e.clientX, y: e.clientY };
          if (raf.current) return;
          raf.current = requestAnimationFrame(() => {
            raf.current = 0;
            const r = rect.current;
            if (!r) return;
            px.set((last.current.x - r.left) / r.width);
            py.set((last.current.y - r.top) / r.height);
          });
        }}
        onPointerLeave={() => {
          rect.current = null;
          setHover(false);
          px.set(0.5);
          py.set(0.5);
        }}
        style={{ rotateX, rotateY, z: 6, transformStyle: "preserve-3d", willChange: hover ? "transform" : "auto", position: "relative", ...style }}
      >
        {children}
        <motion.div
          aria-hidden
          style={{ position: "absolute", inset: 0, borderRadius: "inherit", background: glare, pointerEvents: "none", opacity: hover ? 1 : 0, transition: "opacity .3s ease" }}
        />
      </motion.div>
    </div>
  );
}
