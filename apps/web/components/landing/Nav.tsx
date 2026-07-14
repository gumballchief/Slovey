"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LogoGlyph } from "@/components/ui/Logo";
import { Magnetic } from "./motion";

const EASE = [0.16, 1, 0.3, 1] as const;

type MenuKey = "product" | "developers" | "company";
const MENUS: Record<MenuKey, { label: string; items: { t: string; d: string; href: string }[] }> = {
  product: {
    label: "Product",
    items: [
      { t: "Decision Graph", d: "The structured memory agents query before they act.", href: "#features" },
      { t: "Pre-commit Review", d: "Every change checked before a human sees it.", href: "#workflow" },
      { t: "Rule Enforcement", d: "Conventions encoded once, enforced everywhere.", href: "#features" },
      { t: "MCP Server", d: "One context layer for every AI tool.", href: "/mcp" },
    ],
  },
  developers: {
    label: "Developers",
    items: [
      { t: "Docs", d: "Quickstart, guides, and the JSON contract.", href: "/docs" },
      { t: "API Reference", d: "REST endpoints for the decision graph.", href: "/api-reference" },
      { t: "slovey CLI", d: "Run the gate locally or in CI.", href: "/docs" },
      { t: "MCP Integration", d: "Wire Claude, Cursor, Codex, and more.", href: "/mcp" },
    ],
  },
  company: {
    label: "Company",
    items: [
      { t: "About", d: "Why engineering memory matters.", href: "/about" },
      { t: "Changelog", d: "What's new in Slovey.", href: "/changelog" },
      { t: "Careers", d: "Help build the memory layer.", href: "/careers" },
      { t: "Contact", d: "Talk to the team.", href: "/contact" },
    ],
  },
};

export function Nav() {
  const reduce = useReducedMotion();
  const [frost, setFrost] = useState(false);
  const [open, setOpen] = useState<MenuKey | null>(null);
  const [dark, setDark] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setFrost(window.scrollY > 20);
    onScroll();
    // Sync the toggle with the class the no-flash init script already applied.
    setDark(document.documentElement.classList.contains("cb-dark"));
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("cb-dark", next);
    try {
      localStorage.setItem("slovey-landing-theme", next ? "dark" : "light");
    } catch {
      /* private mode — theme just won't persist */
    }
  };

  const enter = (k: MenuKey) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(k);
  };
  const leave = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(null), 130);
  };

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        transition: "background .35s ease, box-shadow .35s ease, border-color .35s ease",
        background: frost ? "var(--l-frost)" : "transparent",
        backdropFilter: frost ? "blur(16px)" : "none",
        WebkitBackdropFilter: frost ? "blur(16px)" : "none",
        borderBottom: frost ? "1px solid var(--l-border-soft)" : "1px solid transparent",
      }}
      onMouseLeave={leave}
    >
      <nav style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
        <a href="#top" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "var(--l-ink)" }}>
          <LogoGlyph size={32} />
          <span style={{ fontFamily: "var(--font-serif), Georgia, serif", fontWeight: 500, fontSize: 20, letterSpacing: "-0.01em" }}>Slovey</span>
        </a>

        <div style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 14, color: "var(--l-body)" }} className="cb-nav-links">
          {(Object.keys(MENUS) as MenuKey[]).map((k) => (
            <div key={k} onMouseEnter={() => enter(k)} style={{ padding: "9px 13px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: open === k ? "var(--l-ink)" : "var(--l-body)", transition: "color .2s" }}>
              {MENUS[k].label}
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.45, transform: open === k ? "rotate(180deg)" : "none", transition: "transform .22s cubic-bezier(.16,1,.3,1)" }} aria-hidden>
                <path d="M3 4.5 6 7.5 9 4.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          ))}
          <a href="#pricing" style={{ padding: "9px 13px", color: "inherit", textDecoration: "none", transition: "color .2s" }} onMouseEnter={(e) => (e.currentTarget.style.color = "var(--l-ink)")} onMouseLeave={(e) => (e.currentTarget.style.color = "inherit")}>Pricing</a>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 10, border: "1px solid var(--l-border)", background: "var(--l-card)", color: "var(--l-body)", cursor: "pointer", transition: "color .2s, border-color .2s" }}
          >
            {dark ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
              </svg>
            )}
          </button>
          <a href="/login" style={{ fontSize: 14.5, color: "var(--l-body)", textDecoration: "none" }}>Sign in</a>
          <Magnetic>
            <a href="/login" className="cb-cta" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 500, color: "var(--l-btn-text)", textDecoration: "none", padding: "9px 18px", borderRadius: 10, background: "var(--l-btn)", transition: "background .2s ease, filter .2s ease" }}>
              Start free <span className="cb-cta-arrow" aria-hidden>→</span>
            </a>
          </Magnetic>
        </div>
      </nav>

      {/* mega-menu panel */}
      <AnimatePresence>
        {open && !reduce && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.26, ease: EASE }}
            onMouseEnter={() => enter(open)}
            style={{ position: "absolute", left: 0, right: 0, top: "100%", background: "var(--l-card-strong)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--l-border)", boxShadow: "0 30px 60px -30px rgba(30,40,90,.3)" }}
          >
            <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>
              {MENUS[open].items.map((it) => (
                <a key={it.t} href={it.href} style={{ display: "block", padding: "12px 14px", borderRadius: 10, textDecoration: "none", transition: "background .2s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(125,130,145,.10)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <div style={{ fontFamily: "var(--font-inter-tight), sans-serif", fontWeight: 600, fontSize: 14.5, letterSpacing: "-0.01em", color: "var(--l-ink)" }}>{it.t}</div>
                  <div style={{ fontSize: 13, color: "var(--l-muted)", marginTop: 3, lineHeight: 1.45 }}>{it.d}</div>
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
