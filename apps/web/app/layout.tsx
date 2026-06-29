import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

// Display — h1/h2 and big numbers only
const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Body
const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
  const theme = cookieStore.get("theme")?.value ?? "light";
  const isDark = theme === "dark";

  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} h-full${isDark ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-[var(--bg)] text-[var(--cb-text)] font-body antialiased">
        {/* Swallow noise from browser extensions (e.g. MetaMask's inpage.js)
            so it never reaches the dev error overlay. Scoped strictly to
            chrome-extension:// sources — never suppresses app errors. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
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
})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
