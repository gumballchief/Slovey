import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
import { SITE_URL } from "@/lib/site";

// Bellefair (thin display serif) for headlines, Afacad Flux for text and UI, Geist Mono for code.
// All three are served from the repo (SIL OFL), so a build never depends on fetching Google Fonts.
const bellefair = localFont({
  src: "./fonts/bellefair-400.woff2",
  weight: "400",
  variable: "--font-bellefair",
  display: "swap",
});
const afacad = localFont({
  src: "./fonts/afacad-flux-var.woff2",
  weight: "100 1000",
  variable: "--font-afacad",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Slovey: memory for your coding agents", template: "%s | Slovey" },
  description:
    "Slovey learns your team's decisions from GitHub and blocks any change that breaks one, citing the pull request it came from. Open source, with an MCP server for Claude Code and Cursor.",
  applicationName: "Slovey",
  // Icons come from app/favicon.ico, app/icon.png and app/apple-icon.png (built from the logo layers).
};

export const viewport: Viewport = { themeColor: "#01010a", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bellefair.variable} ${afacad.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
