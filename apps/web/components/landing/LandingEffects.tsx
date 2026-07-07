"use client";

import { useEffect } from "react";

const GITHUB_APP_INSTALL = "https://github.com/apps/company-brain/installations/new";

/**
 * Client-side effects for the ported design landing. The markup is rendered via
 * dangerouslySetInnerHTML (from the design's own output), so interactivity is
 * wired here after mount: scroll-reveal, magnetic hover, CTA hrefs, FAQ accordion,
 * and the pricing monthly/annual toggle. Renders nothing.
 */
export function LandingEffects() {
  useEffect(() => {
    const root = document.getElementById("cb-landing");
    if (!root) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion:reduce)").matches;
    const cleanups: Array<() => void> = [];

    // ── scroll reveal (staggered blur-up, once) ──
    // Scroll-driven rather than IntersectionObserver: reveals whatever is in view
    // on mount (so the hero shows instantly) and the rest as they scroll in. Robust
    // against StrictMode double-mount and observer threshold edge cases.
    const revealEls = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    const show = (el: HTMLElement) => {
      const sibs = el.parentElement
        ? Array.from(el.parentElement.querySelectorAll<HTMLElement>(":scope > [data-reveal]"))
        : [el];
      el.style.transitionDelay = `${Math.min(Math.max(0, sibs.indexOf(el)), 6) * 85}ms`;
      el.style.opacity = "1";
      el.style.transform = "none";
      el.style.filter = "none";
    };
    if (reduce) {
      revealEls.forEach(show);
    } else {
      const pending = new Set(revealEls);
      const inView = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return r.top < window.innerHeight * 0.9 && r.bottom > 0;
      };
      const tick = () => {
        for (const el of [...pending]) {
          if (inView(el)) {
            show(el);
            pending.delete(el);
          }
        }
        if (pending.size === 0) {
          window.removeEventListener("scroll", tick);
          window.removeEventListener("resize", tick);
        }
      };
      tick(); // reveal above-the-fold immediately
      window.addEventListener("scroll", tick, { passive: true });
      window.addEventListener("resize", tick, { passive: true });
      cleanups.push(() => {
        window.removeEventListener("scroll", tick);
        window.removeEventListener("resize", tick);
      });
    }

    // ── magnetic hover ──
    const magnets = Array.from(root.querySelectorAll<HTMLElement>("[data-magnetic]"));
    const onMove = (el: HTMLElement) => (ev: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const mx = ev.clientX - r.left - r.width / 2;
      const my = ev.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${(mx * 0.22).toFixed(1)}px, ${(my * 0.3).toFixed(1)}px)`;
    };
    if (!reduce) {
      for (const el of magnets) {
        const move = onMove(el);
        const leave = () => {
          el.style.transform = "";
        };
        el.addEventListener("mousemove", move);
        el.addEventListener("mouseleave", leave);
        cleanups.push(() => {
          el.removeEventListener("mousemove", move);
          el.removeEventListener("mouseleave", leave);
        });
      }
    }

    // ── wire CTAs to real routes ──
    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>("a"));
    for (const a of links) {
      const t = (a.textContent || "").trim().toLowerCase();
      if (t === "sign in") a.href = "/login";
      else if (/^(start free|get started|start building|start now|create account)/.test(t)) a.href = "/login";
      else if (/connect (a )?repo/.test(t)) {
        a.href = GITHUB_APP_INSTALL;
        a.target = "_blank";
        a.rel = "noreferrer";
      }
    }

    return () => cleanups.forEach((c) => c());
  }, []);

  return null;
}
