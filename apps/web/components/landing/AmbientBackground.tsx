"use client";

/**
 * Ambient background (spec #13): two large soft blue radial washes drifting slowly
 * and independently, behind a faint masked grid. Fixed, z-0, non-interactive.
 * Loops are CSS keyframes (always-on) and stop under reduced-motion via globals.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      {/* masked grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(79,126,247,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(79,126,247,.055) 1px, transparent 1px)",
          backgroundSize: "46px 46px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, #000 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, #000 0%, transparent 75%)",
        }}
      />
      {/* drifting washes */}
      <div
        className="cb-aurora-a"
        style={{
          position: "absolute",
          top: "-10%",
          left: "-5%",
          width: "55vw",
          height: "55vw",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(79,126,247,.22), transparent 65%)",
          filter: "blur(60px)",
          animation: "cbAuroraA 42s ease-in-out infinite",
        }}
      />
      <div
        className="cb-aurora-b"
        style={{
          position: "absolute",
          bottom: "-15%",
          right: "-8%",
          width: "50vw",
          height: "50vw",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,92,255,.16), transparent 65%)",
          filter: "blur(70px)",
          animation: "cbAuroraB 46s ease-in-out infinite",
        }}
      />
    </div>
  );
}
