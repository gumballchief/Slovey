"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { GITHUB_APP_INSTALL_URL } from "@/lib/github-app";
import { AnimatedHeadline } from "./AnimatedHeadline";
import { Magnetic } from "./motion";

const EASE = [0.16, 1, 0.3, 1] as const;

const GITHUB_REPO_URL = "https://github.com/gumballchief/slovey";
const INSTALL_CMD = "npm i -g slovey";

/** The install command, one click to copy. */
function InstallCommand() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    // execCommand fallback because the clipboard API needs a secure context and
    // silently rejects in some embedded browsers.
    navigator.clipboard?.writeText(INSTALL_CMD).catch(() => {
      const t = document.createElement("textarea");
      t.value = INSTALL_CMD;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      document.body.removeChild(t);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy install command: ${INSTALL_CMD}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 12, padding: "12px 16px",
        borderRadius: 10, background: "var(--l-card-strong)", border: "1px solid var(--l-border)",
        fontFamily: "var(--font-mono), monospace", fontSize: 14, color: "var(--l-ink)",
        cursor: "pointer", transition: "border-color .2s ease",
      }}
    >
      <span style={{ color: "var(--l-muted)" }} aria-hidden>$</span>
      <span>{INSTALL_CMD}</span>
      <span style={{ fontSize: 12, color: "var(--l-muted)", minWidth: 44, textAlign: "left" }}>
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}


/** Hero section — headline pop-in gated on the intro loader, magnetic CTAs. */
export function Hero({ introDone }: { introDone: boolean }) {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  // badge/subhead/CTAs rise in after the headline starts
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 22 },
          animate: introDone ? { opacity: 1, y: 0 } : {},
          transition: { duration: 0.7, ease: EASE, delay },
        };

  return (
    <section ref={sectionRef} id="top" style={{ position: "relative", zIndex: 1, maxWidth: 1180, margin: "0 auto", padding: "clamp(120px, 15vh, 158px) 24px 0", textAlign: "center" }}>
      <motion.div {...rise(0.1)} style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "7px 15px", borderRadius: 99, background: "var(--l-card-strong)", border: "1px solid var(--l-border)", marginBottom: 30 }}>
        <span className="cb-dot-pulse" style={{ width: 7, height: 7, borderRadius: 99, background: "var(--l-ink)" }} />
        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--l-body)" }}>Engineering Intelligence Platform</span>
      </motion.div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <AnimatedHeadline text="The intelligence layer beneath your AI coding agents" start={introDone} />
      </div>

      <motion.p {...rise(0.35)} style={{ margin: "28px auto 0", maxWidth: 640, fontFamily: "var(--font-serif), Georgia, serif", fontSize: 20, lineHeight: 1.62, color: "var(--l-body)" }}>
        AI writes great code — it just doesn&apos;t know your company. Slovey gives it your context: your codebase, decisions, and history, so mistakes are caught <em style={{ color: "var(--l-ink)", fontStyle: "italic" }}>before</em> code is ever committed.
      </motion.p>

      <motion.div {...rise(0.5)} style={{ marginTop: 38, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
        <Magnetic>
          <a href="/login" className="cb-cta" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 26px", borderRadius: 12, fontWeight: 500, fontSize: 15, color: "var(--l-btn-text)", textDecoration: "none", background: "var(--l-btn)", transition: "background .2s ease, filter .2s ease" }}>
            Start free <span className="cb-cta-arrow" aria-hidden>→</span>
          </a>
        </Magnetic>
        <a href="#workflow" style={{ display: "inline-flex", alignItems: "center", padding: "14px 24px", borderRadius: 12, fontWeight: 500, fontSize: 15, color: "var(--l-ink)", textDecoration: "none", background: "var(--l-card-strong)", border: "1px solid var(--l-border)" }}>
          See how it works
        </a>
      </motion.div>

      {/*
        The install line. It sits directly under the CTAs because the first thing a
        developer arriving from Hacker News looks for is the command — before this,
        it appeared nowhere on the site and the only copy of it lived in the repo,
        which the nav did not link to either.
      */}
      <motion.div {...rise(0.58)} style={{ marginTop: 26, display: "flex", justifyContent: "center" }}>
        <InstallCommand />
      </motion.div>

      <motion.div {...rise(0.62)} style={{ marginTop: 18, marginBottom: 20, fontFamily: "var(--font-mono), monospace", fontSize: 12.5, letterSpacing: "0.04em", color: "var(--l-muted)" }}>
        Open source (MIT) · <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>View on GitHub</a> · No credit card
      </motion.div>
    </section>
  );
}
