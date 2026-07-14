import type { Metadata } from "next";
import { Bricolage_Grotesque, Fraunces, Hanken_Grotesk, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";
import "./globals.css";

// Display — Bricolage Grotesque: a characterful, editorial grotesque. The face
// with real personality that keeps the headlines from reading "default AI sans".
const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  display: "swap",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Serif display — Fraunces: a high-contrast, literary variable serif. The
// editorial voice for the landing's headlines (an intentional, un-templated
// pairing against the grotesque body — the calm, premium register the design
// is built around).
const fraunces = Fraunces({
  variable: "--font-serif",
  display: "swap",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

// Body — Hanken Grotesk: a warm, clean grotesk (deliberately not Inter/Roboto).
const hanken = Hanken_Grotesk({
  variable: "--font-body",
  display: "swap",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Inter Tight — the marketing landing's body face (matches the design). Scoped to
// the landing via --font-inter-tight; the dashboard keeps Hanken (--font-body).
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  display: "swap",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Mono — the brand's connective tissue: PR numbers, citations, labels, units
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  display: "swap",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://company-brain-web-u04w.onrender.com"),
  title: {
    default: "Slovey — Engineering Memory for Your Team",
    template: "%s",
  },
  description:
    "Slovey remembers every decision your team has made, so knowledge is never lost or re-explained. Warns on conflicting PRs before human review.",
  applicationName: "Slovey",
  openGraph: {
    type: "website",
    siteName: "Slovey",
    title: "Slovey — Engineering Memory for Your Team",
    description:
      "The intelligence layer beneath your AI coding agents. Every decision remembered; every mistake caught before commit.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Slovey — Engineering Memory for Your Team",
    description:
      "The intelligence layer beneath your AI coding agents. Every decision remembered; every mistake caught before commit.",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  // Default to light — matches the marketing landing's palette.
  const theme = cookieStore.get("theme")?.value ?? "light";
  const isDark = theme === "dark";

  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${fraunces.variable} ${hanken.variable} ${interTight.variable} ${jetbrainsMono.variable} h-full${isDark ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-[var(--bg)] text-[var(--cb-text)] font-body antialiased">
        {/* Swallow noise from browser extensions (e.g. MetaMask's inpage.js)
            so it never reaches the dev error overlay. Scoped strictly to
            chrome-extension:// sources — never suppresses app errors. Loaded via
            next/script so React 19 actually executes it (a raw <script> in the
            tree is not run on the client and trips the dev overlay). */}
        <Script id="suppress-extension-noise" strategy="beforeInteractive">
          {`(function(){
  if (typeof window === 'undefined') return;
  function fromExtension(t){ return typeof t === 'string' && (t.indexOf('chrome-extension://') !== -1 || /MetaMask/i.test(t)); }
  window.addEventListener('error', function(e){
    var stack = e && e.error && e.error.stack;
    if (fromExtension(e && e.filename) || fromExtension(stack) || fromExtension(e && e.message)) { e.stopImmediatePropagation(); }
  }, true);
  window.addEventListener('unhandledrejection', function(e){
    var r = e && e.reason; var t = (r && (r.stack || r.message)) || (typeof r === 'string' ? r : '');
    if (fromExtension(t)) { e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
})();`}
        </Script>
        {/* Apply the saved landing theme before paint so dark-mode visitors
            never see a flash of the light landing. Scoped class on <html>;
            the landing's dark vars key off html.cb-dark #cb-landing. */}
        <Script id="landing-theme-init" strategy="beforeInteractive">
          {`(function(){try{if(localStorage.getItem('slovey-landing-theme')==='dark')document.documentElement.classList.add('cb-dark');}catch(e){}})();`}
        </Script>
        {children}
      </body>
    </html>
  );
}
