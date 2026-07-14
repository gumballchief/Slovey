"use client";

/**
 * Ambient background — a calm, editorial substrate. A soft overhead light, a
 * faint hairline grid that fades toward the center, two column rules that frame
 * the content width, and edge vignettes that quiet the sides. Deliberately still:
 * the typography, whitespace, and scroll motion carry the page. Fixed, z-0,
 * non-interactive, no animation loop (nothing to throttle or repaint).
 */
export function AmbientBackground() {
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      {/* soft overhead light — a restrained brand whisper at the top center */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          width: "120vw",
          height: "54vh",
          transform: "translateX(-50%)",
          background: "radial-gradient(ellipse 48% 100% at 50% 0%, var(--l-aur-a), transparent 72%)",
          opacity: 0.55,
        }}
      />
      {/* faint hairline grid, masked to fade toward the center */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "linear-gradient(var(--l-grid) 1px, transparent 1px), linear-gradient(90deg, var(--l-grid) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 94% 72% at 50% 32%, #000 18%, transparent 78%)",
          WebkitMaskImage: "radial-gradient(ellipse 94% 72% at 50% 32%, #000 18%, transparent 78%)",
        }}
      />
      {/* two hairline column rules framing the content width — editorial structure */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "50%",
          width: 1180,
          maxWidth: "94vw",
          transform: "translateX(-50%)",
          borderLeft: "1px solid var(--l-grid)",
          borderRight: "1px solid var(--l-grid)",
          maskImage: "linear-gradient(#000 0%, #000 55%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(#000 0%, #000 55%, transparent 100%)",
        }}
      />
      {/* edge vignettes → fade the sides into the canvas so the center reads clean */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, var(--l-canvas), transparent 15%, transparent 85%, var(--l-canvas))" }} />
    </div>
  );
}
