"use client";

import { useEffect } from "react";
import { GITHUB_APP_INSTALL_URL } from "@/lib/github-app";

/**
 * Client-side effects for the ported design landing. The markup is rendered via
 * dangerouslySetInnerHTML (from the design's own output), so interactivity is
 * wired here after mount: scroll-reveal, magnetic hover, and CTA hrefs. Renders
 * nothing. (FAQ + pricing are now real React components.)
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
    const reveal = (el: HTMLElement) => {
      const sibs = el.parentElement
        ? Array.from(el.parentElement.querySelectorAll<HTMLElement>(":scope > [data-reveal]"))
        : [el];
      el.style.transitionDelay = `${Math.min(Math.max(0, sibs.indexOf(el)), 6) * 85}ms`;
      el.classList.remove("cb-pre"); // animate opacity/transform back to visible
    };
    // Fail-safe: elements are visible by default (CSS). Only hide the ones below
    // the fold and animate them in on scroll — so a section can never end up
    // permanently invisible, which is what made whole sections read as gaps.
    if (!reduce && typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              reveal(e.target as HTMLElement);
              io.unobserve(e.target);
            }
          }
        },
        { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
      );
      const vh = window.innerHeight;
      for (const el of revealEls) {
        if (el.getBoundingClientRect().top > vh * 0.9) {
          el.classList.add("cb-pre"); // below the fold → hide, then reveal on scroll
          io.observe(el);
        }
      }
      // Absolute backstop: if IO never fires for something, reveal it anyway so
      // nothing can stay hidden. Long enough that normal scrolling wins the race.
      const safety = setTimeout(() => revealEls.forEach((el) => el.classList.remove("cb-pre")), 4500);
      cleanups.push(() => {
        io.disconnect();
        clearTimeout(safety);
      });
    }

    // ── magnetic hover (rect cached on enter; moves coalesced to one per frame) ──
    const magnets = Array.from(root.querySelectorAll<HTMLElement>("[data-magnetic]"));
    if (!reduce) {
      for (const el of magnets) {
        let rect: DOMRect | null = null;
        let raf = 0;
        let lastX = 0;
        let lastY = 0;
        const enter = () => {
          rect = el.getBoundingClientRect();
        };
        const move = (ev: MouseEvent) => {
          lastX = ev.clientX;
          lastY = ev.clientY;
          if (raf) return;
          raf = requestAnimationFrame(() => {
            raf = 0;
            if (!rect) return;
            const mx = lastX - rect.left - rect.width / 2;
            const my = lastY - rect.top - rect.height / 2;
            el.style.transform = `translate(${(mx * 0.22).toFixed(1)}px, ${(my * 0.3).toFixed(1)}px)`;
          });
        };
        const leave = () => {
          rect = null;
          cancelAnimationFrame(raf);
          raf = 0;
          el.style.transform = "";
        };
        el.addEventListener("mouseenter", enter);
        el.addEventListener("mousemove", move);
        el.addEventListener("mouseleave", leave);
        cleanups.push(() => {
          el.removeEventListener("mouseenter", enter);
          el.removeEventListener("mousemove", move);
          el.removeEventListener("mouseleave", leave);
          cancelAnimationFrame(raf);
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
        a.href = GITHUB_APP_INSTALL_URL;
        a.target = "_blank";
        a.rel = "noreferrer";
      }
    }

    // FAQ + pricing are now real React components (FAQSection, PricingSection) —
    // their interactivity lives in those components, not in hand-wired DOM here.

    return () => cleanups.forEach((c) => c());
  }, []);

  return null;
}
