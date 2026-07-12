"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setFrost(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
        background: frost ? "rgba(246,244,251,.82)" : "transparent",
        backdropFilter: frost ? "blur(16px)" : "none",
        WebkitBackdropFilter: frost ? "blur(16px)" : "none",
        borderBottom: frost ? "1px solid rgba(28,20,45,.08)" : "1px solid transparent",
      }}
      onMouseLeave={leave}
    >
      <nav style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
        <a href="#top" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "#1b1726" }}>
          <span style={{ width: 32, height: 32, borderRadius: 9, background: "#4f7ef7", display: "grid", placeItems: "center", boxShadow: "0 5px 16px -6px #4f7ef7" }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="7.5" r="2.1" /><circle cx="18" cy="7.5" r="2.1" /><circle cx="12" cy="16.5" r="2.1" /><path d="M7.8 9.1 10.5 14.6" /><path d="M16.2 9.1 13.5 14.6" /><path d="M8.1 7.5h7.8" />
            </svg>
          </span>
          <span style={{ fontFamily: "var(--font-display), sans-serif", fontWeight: 600, fontSize: 17, letterSpacing: "-0.01em" }}>Slovey</span>
        </a>

        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14.5, color: "#565163" }} className="cb-nav-links">
          {(Object.keys(MENUS) as MenuKey[]).map((k) => (
            <div key={k} onMouseEnter={() => enter(k)} style={{ padding: "10px 14px", borderRadius: 9, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: open === k ? "#1b1726" : "#565163", transition: "color .2s" }}>
              {MENUS[k].label} <span style={{ fontSize: 9, opacity: 0.55, transform: open === k ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▼</span>
            </div>
          ))}
          <a href="#pricing" style={{ padding: "10px 14px", color: "inherit", textDecoration: "none" }}>Pricing</a>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <a href="/login" style={{ fontSize: 14.5, color: "#565163", textDecoration: "none" }}>Sign in</a>
          <Magnetic>
            <a href="/login" className="cb-cta" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 500, color: "#fbfaff", textDecoration: "none", padding: "9px 17px", borderRadius: 10, background: "linear-gradient(120deg,#241d33,#463a63)", boxShadow: "0 8px 26px -10px rgba(255,120,100,.7)" }}>
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
            style={{ position: "absolute", left: 0, right: 0, top: "100%", background: "rgba(255,255,255,.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid #e3e9f5", boxShadow: "0 30px 60px -30px rgba(30,40,90,.3)" }}
          >
            <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>
              {MENUS[open].items.map((it) => (
                <a key={it.t} href={it.href} style={{ display: "block", padding: "12px 14px", borderRadius: 11, textDecoration: "none", transition: "background .2s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5fc")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <div style={{ fontFamily: "var(--font-display), sans-serif", fontWeight: 600, fontSize: 15, color: "#1b1726" }}>{it.t}</div>
                  <div style={{ fontSize: 13, color: "#6b6678", marginTop: 3 }}>{it.d}</div>
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
