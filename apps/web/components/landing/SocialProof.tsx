"use client";

/**
 * Subtle social-proof band under the hero. PLACEHOLDER ONLY — no real customer
 * names or metrics are claimed. Swap the ghost slots for real customer logos, or
 * replace the caption with a one-line testimonial / headline metric once you have
 * one. Kept intentionally muted so it reads as "to be filled", not a false claim.
 */
export function SocialProof() {
  return (
    <div style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "64px auto 0", padding: "0 24px", textAlign: "center" }}>
      <p style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "#9a95ab", margin: 0 }}>
        Social proof goes here — add customer logos, a quote, or a metric
      </p>
      <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", opacity: 0.5 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            aria-hidden
            style={{
              width: 116,
              height: 36,
              borderRadius: 9,
              border: "1px dashed #c7cfe0",
              background: "rgba(255,255,255,.5)",
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--font-mono), monospace",
              fontSize: 11,
              letterSpacing: "0.1em",
              color: "#a8a4b6",
            }}
          >
            LOGO
          </div>
        ))}
      </div>
    </div>
  );
}
