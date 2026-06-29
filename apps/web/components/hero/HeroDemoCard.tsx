"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";

const PR_DIFF = `+ render.yaml
+
+ services:
+   - type: web
+     name: api
+     env: node
+     buildCommand: npm run build
+     startCommand: npm start`;

const DECISION = {
  text: "Platform-specific deploy config files are rejected — render.yaml, fly.toml, Procfile, vercel.json.",
  why: "We deploy via our internal CI/CD pipeline. Committing platform-specific config creates confusion about the deployment target.",
  evidence: "PR #29501",
};

export function HeroDemoCard() {
  const [phase, setPhase] = useState<"idle" | "scanning" | "found" | "cited">("idle");

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    function cycle() {
      setPhase("idle");
      timers.push(setTimeout(() => setPhase("scanning"), 800));
      timers.push(setTimeout(() => setPhase("found"), 2000));
      timers.push(setTimeout(() => setPhase("cited"), 2800));
      timers.push(setTimeout(cycle, 7000));
    }
    cycle();
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div
      className="relative w-full max-w-3xl mx-auto"
      aria-label="Live demo: Company Brain catching a conflicting PR"
      role="img"
    >
      {/* Glow behind */}
      <div
        className="absolute inset-0 -z-10 rounded-2xl"
        style={{
          background:
            "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(56,189,248,0.08) 0%, transparent 70%)",
        }}
      />

      <div className="grid sm:grid-cols-2 gap-0 card overflow-hidden border-[var(--border)]">
        {/* Left: PR */}
        <div className="p-5 border-b sm:border-b-0 sm:border-r border-[var(--border)]">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-xs text-[var(--text-muted)] ml-1">
              PR #412 — add render.yaml
            </span>
          </div>
          <pre
            className="font-mono text-xs leading-relaxed overflow-x-auto"
            style={{ color: "var(--cb-text)" }}
          >
            {PR_DIFF.split("\n").map((line, i) => (
              <div
                key={i}
                className={`px-1 rounded ${line.startsWith("+") ? "bg-emerald-500/10 text-emerald-400" : ""}`}
              >
                {line || " "}
              </div>
            ))}
          </pre>

          {/* Scanning indicator */}
          <div
            className={`mt-4 flex items-center gap-2 transition-opacity duration-300 ${phase === "scanning" ? "opacity-100" : "opacity-0"}`}
            aria-live="polite"
          >
            <span className="w-3 h-3 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-[var(--text-muted)]">Checking against memory…</span>
          </div>
        </div>

        {/* Right: Decision */}
        <div className="p-5 relative">
          {/* Conflict badge */}
          <div
            className={`flex items-center gap-2 mb-3 transition-all duration-300 ${
              phase === "found" || phase === "cited" ? "opacity-100" : "opacity-0"
            }`}
          >
            <AlertTriangle size={13} className="text-rose-400" />
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wide">
              Conflict found
            </span>
          </div>

          <div
            className={`space-y-3 transition-all duration-500 ${
              phase === "cited" ? "opacity-100" : "opacity-0"
            }`}
            aria-live="polite"
          >
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-xs font-medium text-[var(--cb-text)] leading-snug">
                {DECISION.text}
              </p>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">{DECISION.why}</p>
            <div className="flex items-center gap-2 pt-1">
              <span className="font-mono text-xs bg-[var(--primary-soft)] text-[var(--primary)] px-2 py-0.5 rounded flex items-center gap-1">
                <ExternalLink size={9} />
                {DECISION.evidence}
              </span>
              <span className="text-2xs text-[var(--text-muted)]">
                Confidence: high
              </span>
            </div>
          </div>

          {/* Idle placeholder */}
          <div
            className={`absolute inset-5 flex items-center justify-center transition-opacity duration-300 ${
              phase === "idle" ? "opacity-100" : "opacity-0"
            }`}
          >
            <p className="text-xs text-[var(--text-muted)] text-center">
              Waiting for PR…
            </p>
          </div>
        </div>
      </div>

      {/* SVG connector line */}
      <svg
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none hidden sm:block"
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="20"
          cy="20"
          r="6"
          fill="var(--primary)"
          className={`transition-opacity duration-300 ${
            phase === "found" || phase === "cited" ? "opacity-100" : "opacity-0"
          }`}
          style={{ filter: "drop-shadow(0 0 6px var(--primary))" }}
        />
      </svg>

      {/* Caption */}
      <p className="text-center text-xs text-[var(--text-muted)] mt-3">
        Company Brain catches this before any human reviews it, citing exactly which decision was violated.
      </p>
    </div>
  );
}
