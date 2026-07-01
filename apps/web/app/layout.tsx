import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";
import "./globals.css";

// Display — Bricolage Grotesque: a characterful, editorial grotesque. The face
// with real personality that keeps the headlines from reading "default AI sans".
const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Body — Hanken Grotesk: a warm, clean grotesk (deliberately not Inter/Roboto).
const hanken = Hanken_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Mono — the brand's connective tissue: PR numbers, citations, labels, units
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Company Brain — Engineering Memory for Your Team",
  description:
    "Company Brain remembers every decision your team has made, so knowledge is never lost or re-explained. Warns on conflicting PRs before human review.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value ?? "dark";
  const isDark = theme === "dark";

  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${hanken.variable} ${jetbrainsMono.variable} h-full${isDark ? " dark" : ""}`}
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
        {children}
      </body>
    </html>
  );
}
