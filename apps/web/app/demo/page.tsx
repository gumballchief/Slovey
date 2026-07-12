"use client";

import { useState } from "react";
import { PublicNav } from "@/components/layout/PublicNav";
import { VerdictPill } from "@/components/ui/VerdictPill";
import { Badge } from "@/components/ui/Badge";
import { Brain, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

const DEMO_PRS = [
  {
    number: 412,
    title: "Add render.yaml for Render.com deployment",
    author: "jsmith",
    verdict: "conflict" as const,
    decision: "Platform-specific deploy config files are rejected — render.yaml, fly.toml, Procfile, vercel.json.",
    why: "We deploy via our internal CI/CD pipeline. Committing platform-specific config creates confusion about the deployment target and risks accidental deploys.",
    evidence: ["PR #29501", "PR #29312"],
    diff: `+ render.yaml
+
+ services:
+   - type: web
+     name: api
+     env: node
+     buildCommand: npm run build
+     startCommand: npm start`,
  },
  {
    number: 410,
    title: "Add Paystack payment integration",
    author: "devrel-bot",
    verdict: "conflict" as const,
    decision: "All new third-party payment integrations require a formal vendor review. Payments must be handled through the internal payments-service.",
    why: "Payments touch PCI scope — any new provider changes our compliance surface.",
    evidence: ["PR #29296", "PR #10803"],
    diff: `+ import Paystack from 'paystack';
+
+ export async function chargeCard(amount: number) {
+   const paystack = new Paystack(process.env.PAYSTACK_KEY);
+   return paystack.transaction.initialize({ amount });
+ }`,
  },
  {
    number: 411,
    title: "Refactor auth token refresh flow",
    author: "amara",
    verdict: "clear" as const,
    decision: null,
    why: null,
    evidence: [],
    diff: `- const token = refreshTokenLegacy(user.id);
+ const token = await refreshToken(user.id, { rotate: true });`,
  },
];

export default function DemoPage() {
  const [selected, setSelected] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const pr = DEMO_PRS[selected];

  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      <PublicNav />

      <main className="pt-20 pb-12 px-4 sm:px-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-medium bg-[var(--primary-soft)] text-[var(--primary)] px-3 py-1.5 rounded-full border border-[var(--primary)]/20 mb-4">
            <Brain size={12} />
            Interactive Demo — No install needed
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--cb-text)] tracking-tight">
            See Slovey in action
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Pick a PR below to see how Slovey checks it against memory.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* PR selector */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-3">
              Sample PRs
            </p>
            {DEMO_PRS.map((p, i) => (
              <button
                key={p.number}
                onClick={() => { setSelected(i); setExpanded(true); }}
                className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                  selected === i
                    ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <VerdictPill verdict={p.verdict} size="sm" />
                  <span className="font-mono text-xs text-[var(--text-muted)]">#{p.number}</span>
                </div>
                <p className="text-xs font-medium text-[var(--cb-text)] leading-snug">{p.title}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">@{p.author}</p>
              </button>
            ))}
          </div>

          {/* Main view */}
          <div className="lg:col-span-2 space-y-4">
            {/* PR diff */}
            <div className="card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="font-mono text-xs text-[var(--text-muted)] ml-2">
                  PR #{pr.number} — {pr.title}
                </span>
                <VerdictPill verdict={pr.verdict} size="sm" className="ml-auto" />
              </div>
              <div className="p-4">
                <pre className="font-mono text-xs leading-relaxed overflow-x-auto">
                  {pr.diff.split("\n").map((line, i) => (
                    <div
                      key={i}
                      className={`px-2 py-0.5 rounded ${
                        line.startsWith("+")
                          ? "bg-emerald-500/10 text-emerald-400"
                          : line.startsWith("-")
                          ? "bg-rose-500/10 text-rose-400"
                          : "text-[var(--text-muted)]"
                      }`}
                    >
                      {line || " "}
                    </div>
                  ))}
                </pre>
              </div>
            </div>

            {/* Slovey verdict */}
            {pr.verdict === "conflict" && pr.decision ? (
              <div className="card overflow-hidden border-rose-500/20">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-rose-500/5 cursor-pointer"
                  aria-expanded={expanded}
                >
                  <div className="w-6 h-6 rounded-lg bg-[var(--primary)] flex items-center justify-center shrink-0">
                    <Brain size={12} className="text-white" />
                  </div>
                  <span className="text-sm font-semibold text-[var(--cb-text)] flex-1 text-left">
                    Slovey · Conflict found
                  </span>
                  <Badge variant="default">high confidence</Badge>
                  {expanded ? <ChevronUp size={14} className="text-[var(--text-muted)]" /> : <ChevronDown size={14} className="text-[var(--text-muted)]" />}
                </button>

                {expanded && (
                  <div className="p-5 space-y-4">
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                      <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
                        Past Decision
                      </p>
                      <p className="text-sm font-semibold text-[var(--cb-text)] leading-snug">
                        {pr.decision}
                      </p>
                    </div>

                    {pr.why && (
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Why</p>
                        <p className="text-sm text-[var(--text-muted)] leading-relaxed">{pr.why}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Evidence</p>
                      <div className="flex flex-wrap gap-2">
                        {pr.evidence.map((ev) => (
                          <span
                            key={ev}
                            className="font-mono text-xs bg-[var(--primary-soft)] text-[var(--primary)] px-2.5 py-1 rounded flex items-center gap-1.5"
                          >
                            <ExternalLink size={10} />
                            {ev}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[var(--border)]">
                      <p className="text-xs text-[var(--text-muted)] font-mono bg-[var(--bg-subtle)] rounded-lg p-3 leading-relaxed">
                        <span className="text-[var(--primary)] font-semibold">**Slovey**</span> found a conflict with a past team decision.<br /><br />
                        <span className="font-semibold">Decision:</span> {pr.decision}<br /><br />
                        <span className="font-semibold">Why:</span> {pr.why}<br /><br />
                        <span className="font-semibold">Evidence:</span> {pr.evidence.join(", ")}<br /><br />
                        <span className="text-[var(--text-muted)]">_Confidence: high · Source: github_pr_</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="card p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Brain size={18} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--cb-text)]">No conflicts found</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    This PR doesn&apos;t conflict with any decisions in memory. Checked {new Date().toLocaleDateString()}.
                  </p>
                </div>
                <VerdictPill verdict="clear" className="ml-auto" />
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Ready to connect your own repo?
          </p>
          <a
            href="/app"
            className="inline-flex items-center gap-2 bg-[var(--primary)] text-[var(--on-primary)] font-medium px-6 py-3 rounded-xl hover:bg-[var(--primary-hover)] transition-colors text-sm"
          >
            Open App →
          </a>
        </div>
      </main>
    </div>
  );
}
