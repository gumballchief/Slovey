"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const MemoryCoreScene = dynamic(() => import("./MemoryCoreScene"), {
  ssr: false,
  loading: () => <CorePoster />,
});

/** Static fallback — shown while the 3D scene loads, under reduced-motion,
 *  or if WebGL is unavailable. */
export function CorePoster() {
  return (
    <div className="relative w-full h-full flex items-center justify-center" aria-hidden="true">
      <svg viewBox="0 0 400 400" className="w-[80%] max-w-md">
        <defs>
          <radialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0A0F1C" />
            <stop offset="70%" stopColor="#0A0F1C" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.5" />
          </radialGradient>
          <filter id="coreBlur">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <circle cx="200" cy="200" r="120" fill="url(#coreGrad)" />
        <circle cx="200" cy="200" r="120" fill="none" stroke="#38BDF8" strokeWidth="1.5" opacity="0.6" filter="url(#coreBlur)" />
        <ellipse cx="200" cy="200" rx="170" ry="60" fill="none" stroke="#38BDF8" strokeWidth="0.75" opacity="0.25" transform="rotate(-20 200 200)" />
        <ellipse cx="200" cy="200" rx="155" ry="50" fill="none" stroke="#38BDF8" strokeWidth="0.75" opacity="0.2" transform="rotate(35 200 200)" />
        {[...Array(14)].map((_, i) => {
          const a = (i / 14) * Math.PI * 2;
          const r = 150 + (i % 3) * 12;
          return (
            <circle
              key={i}
              cx={200 + Math.cos(a) * r}
              cy={200 + Math.sin(a) * r * 0.35}
              r={i % 4 === 0 ? 2.5 : 1.5}
              fill="#38BDF8"
              opacity={i % 4 === 0 ? 0.9 : 0.5}
            />
          );
        })}
      </svg>
    </div>
  );
}

export function MemoryCore({ light = false }: { light?: boolean }) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (reduced) return <CorePoster />;
  return <MemoryCoreScene light={light} />;
}
