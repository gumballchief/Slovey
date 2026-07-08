"use client";

import { useEffect } from "react";
import FAQS from "./faqs.json";

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

    // ── FAQ accordion (single-open; answers injected — closed items ship no answer) ──
    const norm = (s: string) => s.replace(/\s+/g, " ").replace(/[’']/g, "'").trim().toLowerCase();
    const faqButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).filter((b) =>
      FAQS.some((f) => norm(b.textContent || "").startsWith(norm(f.q))),
    );
    // Style template from the one answer the design already rendered.
    const openAnswer = faqButtons.map((b) => b.nextElementSibling as HTMLElement | null).find((el) => el && !("dataset" in el && (el as HTMLElement).dataset.cbFaq));
    const answerCss =
      (openAnswer?.getAttribute("style") || "").replace(/max-height:[^;]*;?/g, "") ||
      "padding:0 4px 4px;color:#565163;font-size:15px;line-height:1.6";
    let openBtn: HTMLButtonElement | null = null;
    // Normalize the design's initially-open answer so it collapses uniformly.
    for (const b of faqButtons) {
      const sib = b.nextElementSibling as HTMLElement | null;
      if (sib && sib.tagName === "DIV" && !sib.dataset.cbFaq) {
        sib.dataset.cbFaq = "1";
        sib.style.overflow = "hidden";
        sib.style.transition = "max-height .4s cubic-bezier(.16,1,.3,1),opacity .3s ease";
        sib.style.maxHeight = `${sib.scrollHeight + 8}px`;
        openBtn = b;
      }
    }
    const collapse = (btn: HTMLButtonElement) => {
      const ans = btn.nextElementSibling as HTMLElement | null;
      if (ans?.dataset.cbFaq) {
        ans.style.maxHeight = "0";
        ans.style.opacity = "0";
      }
      const icon = btn.querySelector<HTMLElement>("[data-arrow],svg,span:last-child");
      if (icon) {
        icon.style.transition = "transform .3s cubic-bezier(.16,1,.3,1), color .2s ease";
        icon.style.transform = "";
        icon.style.color = "";
      }
    };
    const expand = (btn: HTMLButtonElement, answer: string) => {
      let ans = btn.nextElementSibling as HTMLElement | null;
      if (!ans?.dataset.cbFaq) {
        ans = document.createElement("div");
        ans.dataset.cbFaq = "1";
        ans.setAttribute("style", `${answerCss};overflow:hidden;max-height:0;opacity:0;transition:max-height .4s cubic-bezier(.16,1,.3,1),opacity .3s ease`);
        ans.textContent = answer;
        btn.insertAdjacentElement("afterend", ans);
      }
      requestAnimationFrame(() => {
        ans!.style.maxHeight = `${ans!.scrollHeight + 8}px`;
        ans!.style.opacity = "1";
      });
      const icon = btn.querySelector<HTMLElement>("[data-arrow],svg,span:last-child");
      if (icon) {
        icon.style.transition = "transform .3s cubic-bezier(.16,1,.3,1), color .2s ease";
        icon.style.transform = "rotate(45deg)"; // + -> x
        icon.style.color = "#4f7ef7";
      }
    };
    for (const btn of faqButtons) {
      btn.style.cursor = "pointer";
      const faq = FAQS.find((f) => norm(btn.textContent || "").startsWith(norm(f.q)));
      const onClick = () => {
        if (openBtn === btn) {
          collapse(btn);
          openBtn = null;
          return;
        }
        if (openBtn) collapse(openBtn);
        expand(btn, faq?.a ?? "");
        openBtn = btn;
      };
      btn.addEventListener("click", onClick);
      cleanups.push(() => btn.removeEventListener("click", onClick));
    }

    // ── pricing monthly/annual toggle ($49 annual / $59 monthly) ──
    const priceBtns = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).filter((b) =>
      /^(monthly|annual)/.test(norm(b.textContent || "")),
    );
    const monthlyBtn = priceBtns.find((b) => norm(b.textContent || "").startsWith("monthly"));
    const annualBtn = priceBtns.find((b) => norm(b.textContent || "").startsWith("annual"));
    if (monthlyBtn && annualBtn) {
      const activeStyle = annualBtn.getAttribute("style") || "";
      const inactiveStyle = monthlyBtn.getAttribute("style") || "";
      // The big "$49" team price + its billing note (both have nested spans).
      const priceEl = Array.from(root.querySelectorAll<HTMLElement>("span")).find(
        (e) => (e.textContent || "").trim() === "$49",
      );
      const noteEl = Array.from(root.querySelectorAll<HTMLElement>("*")).find(
        (e) =>
          /billed annually/i.test(e.textContent || "") &&
          !Array.from(e.children).some((c) => /billed annually/i.test(c.textContent || "")),
      );
      const set = (annual: boolean) => {
        annualBtn.setAttribute("style", annual ? activeStyle : inactiveStyle);
        monthlyBtn.setAttribute("style", annual ? inactiveStyle : activeStyle);
        if (priceEl) priceEl.textContent = annual ? "$49" : "$59";
        if (noteEl) noteEl.textContent = annual ? "Billed annually · 20% off" : "Billed monthly";
      };
      const onM = () => set(false);
      const onA = () => set(true);
      monthlyBtn.addEventListener("click", onM);
      annualBtn.addEventListener("click", onA);
      cleanups.push(() => {
        monthlyBtn.removeEventListener("click", onM);
        annualBtn.removeEventListener("click", onA);
      });
    }

    return () => cleanups.forEach((c) => c());
  }, []);

  return null;
}
