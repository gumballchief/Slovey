"use client";

import { useEffect, useState } from "react";

/** Brief "power-on" overlay. Particles converge + bloom, then lifts.
 *  Skipped entirely under reduced motion. */
export function IntroLoader() {
  const [mounted, setMounted] = useState(false);
  const [done, setDone] = useState(false);
  const [skip, setSkip] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSkip(true);
      return;
    }
    const t = setTimeout(() => setDone(true), 1200);
    return () => clearTimeout(t);
  }, []);

  // Don't render on the server — avoids hydration mismatch from the
  // dynamic custom-property styles below.
  if (!mounted || skip) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] bg-[#0A0F1C] flex items-center justify-center transition-opacity duration-700 ${
        done ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="relative">
        {/* converging particles */}
        {[...Array(10)].map((_, i) => {
          const a = (i / 10) * Math.PI * 2;
          return (
            <span
              key={i}
              className="absolute w-1 h-1 rounded-full bg-[#38BDF8]"
              style={{
                left: "50%",
                top: "50%",
                animation: `converge 1s ease-in forwards`,
                animationDelay: `${i * 30}ms`,
                ["--cx" as string]: `${Math.cos(a) * 80}px`,
                ["--cy" as string]: `${Math.sin(a) * 80}px`,
              }}
            />
          );
        })}
        <span className="block w-3 h-3 rounded-full bg-[#38BDF8] shadow-[0_0_24px_8px_rgba(56,189,248,0.6)] animate-pulse" />
      </div>
      <style>{`
        @keyframes converge {
          0% { transform: translate(calc(-50% + var(--cx)), calc(-50% + var(--cy))); opacity: 0; }
          60% { opacity: 1; }
          100% { transform: translate(-50%, -50%); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
