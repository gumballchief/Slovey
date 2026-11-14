import type { Metadata, Viewport } from "next";
import { Afacad_Flux, Bellefair } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { SITE_URL } from "@/lib/site";

// Bellefair (thin display serif) for headlines, Afacad Flux for text and UI, Geist Mono for code.
const bellefair = Bellefair({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bellefair",
  display: "swap",
});
const afacad = Afacad_Flux({
  subsets: ["latin"],
  variable: "--font-afacad",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Slovey: memory for your coding agents", template: "%s | Slovey" },
  description:
    "Slovey learns your team's decisions from GitHub and blocks any change that breaks one, citing the pull request it came from. Open source, with an MCP server for Claude Code and Cursor.",
  applicationName: "Slovey",
  icons: { icon: "/brand/mark.png" },
};

export const viewport: Viewport = { themeColor: "#0149dc", colorScheme: "light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bellefair.variable} ${afacad.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
