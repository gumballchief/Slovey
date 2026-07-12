"use client";

/**
 * Ambient background (spec #13): two large soft blue radial washes drifting slowly
 * and independently, behind a faint masked grid. Fixed, z-0, non-interactive.
 * Loops are CSS keyframes (always-on) and stop under reduced-motion via globals.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      {/* masked grid — 72px cells, faded to an ellipse at the top */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(90,110,160,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(90,110,160,.045) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(ellipse 92% 60% at 50% 0%, #000 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 92% 60% at 50% 0%, #000 0%, transparent 75%)",
        }}
      />
      {/* Wash A (accent): 120vw × 80vh, top-centered, drifts over 40s.
          No filter:blur — the long radial falloff reads as blurred, and the layer
          is promoted once (translateZ) so the drift is compositor-only. */}
      <div
        className="cb-aurora-a"
        style={{
          position: "absolute",
          top: "-24%",
          left: "50%",
          marginLeft: "-60vw",
          width: "120vw",
          height: "80vh",
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(79,126,247,.10), rgba(79,126,247,.04) 45%, transparent 72%)",
          transform: "translateZ(0)",
          animation: "cbAuroraA 40s ease-in-out infinite",
          willChange: "transform",
        }}
      />
      {/* Wash B (accent-2): 60vw square, bottom-right, drifts over 46s */}
      <div
        className="cb-aurora-b"
        style={{
          position: "absolute",
          bottom: "-30%",
          right: "-10%",
          width: "60vw",
          height: "60vw",
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(127,176,242,.09), rgba(127,176,242,.035) 45%, transparent 72%)",
          transform: "translateZ(0)",
          animation: "cbAuroraB 46s ease-in-out infinite",
          willChange: "transform",
        }}
      />
    </div>
  );
}
