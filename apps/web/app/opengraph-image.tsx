import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Next wires this up as og:image (and twitter:image) for every page.
export const alt = "Slovey: memory for your coding agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const [tile, dot] = await Promise.all([
    readFile(join(process.cwd(), "public/brand/tile-white.png")),
    readFile(join(process.cwd(), "public/brand/dot-red.png")),
  ]);
  const src = (b: Buffer) => `data:image/png;base64,${b.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "76px 84px",
          background: "radial-gradient(900px 520px at 85% 110%, rgba(61,123,255,0.45), rgba(1,1,10,0) 70%), #01010a",
          color: "#eef0f7",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ position: "relative", width: 64, height: 64, display: "flex" }}>
            <img src={src(tile)} width={64} height={64} style={{ position: "absolute", top: 0, left: 0 }} alt="" />
            <img src={src(dot)} width={64} height={64} style={{ position: "absolute", top: 0, left: 0 }} alt="" />
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>Slovey</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 76, lineHeight: 1.02, fontWeight: 700, letterSpacing: -2, maxWidth: 940 }}>
            Memory for your coding agents.
          </div>
          <div style={{ fontSize: 30, color: "#8a90a6", maxWidth: 900, lineHeight: 1.35 }}>
            It learns your team&apos;s decisions from GitHub and blocks any change that breaks one, citing the pull request it
            came from.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
