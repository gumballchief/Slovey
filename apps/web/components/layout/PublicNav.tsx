"use client";

import { Brain } from "lucide-react";
import { useState, useEffect } from "react";

export function PublicNav() {
  const [isDark, setIsDark] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.cookie = `theme=${next ? "dark" : "light"};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    document.documentElement.classList.toggle("dark", next);
  }

  // Over the dark hero (not scrolled) → force light treatment.
  const onHero = !scrolled;

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[var(--bg)]/80 backdrop-blur-md border-b border-[var(--border)]"
          : "bg-transparent border-b border-transparent"
      }`}
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 flex items-center h-14 gap-6">
        <a href="/" className="flex items-center gap-2.5 shrink-0" aria-label="Company Brain home">
          <div className="w-7 h-7 rounded-lg bg-[var(--primary)] flex items-center justify-center">
            <Brain size={15} className="text-white" />
          </div>
          <span
            className={`font-display font-semibold tracking-[-0.02em] text-sm transition-colors ${
              onHero ? "text-white" : "text-[var(--cb-text)]"
            }`}
          >
            Company Brain
          </span>
        </a>

        <div className="flex items-center gap-1 flex-1">
          <a
            href="/demo"
            className={`label-mono px-3 py-1.5 rounded-lg transition-colors ${
              onHero
                ? "text-white/60 hover:text-white hover:bg-white/10"
                : "text-[var(--text-muted)] hover:text-[var(--cb-text)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            Demo
          </a>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors cursor-pointer ${
              onHero
                ? "text-white/60 hover:text-white hover:bg-white/10"
                : "text-[var(--text-muted)] hover:text-[var(--cb-text)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isDark ? (
                <>
                  <circle cx="12" cy="12" r="4" />
                  <line x1="12" y1="2" x2="12" y2="4" />
                  <line x1="12" y1="20" x2="12" y2="22" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="2" y1="12" x2="4" y2="12" />
                  <line x1="20" y1="12" x2="22" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </>
              ) : (
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              )}
            </svg>
          </button>
          <a
            href="/app"
            className={`label-mono px-4 py-1.5 rounded-lg transition-colors ${
              onHero
                ? "bg-white text-[#0A0F1C] hover:bg-white/90"
                : "bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-hover)]"
            }`}
          >
            Open App
          </a>
        </div>
      </div>
    </nav>
  );
}
