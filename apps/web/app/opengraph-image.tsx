import { ImageResponse } from "next/og";

// Next auto-wires this as og:image (and twitter:image) at /opengraph-image.
export const alt = "Slovey — the intelligence layer beneath your AI coding agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "linear-gradient(135deg, #f4f8ff 0%, #eef3fb 55%, #f2f6fd 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: "#4f7ef7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "34px",
              color: "#ffffff",
            }}
          >
            ◍
          </div>
          <div style={{ fontSize: "34px", fontWeight: 600, color: "#1b1726" }}>Slovey</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "72px", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.02em", color: "#1b1726", maxWidth: "980px" }}>
            The intelligence layer beneath your AI coding agents
          </div>
          <div style={{ marginTop: "28px", fontSize: "30px", color: "#565163" }}>
            Every decision remembered. Every mistake caught before commit.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: "24px", color: "#7c5cff", fontWeight: 600 }}>
          company-brain-web-u04w.onrender.com
        </div>
      </div>
    ),
    { ...size },
  );
}
