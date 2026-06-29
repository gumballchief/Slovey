import { PublicNav } from "@/components/layout/PublicNav";
import { MemoryCore } from "@/components/core/MemoryCore";
import { MeshBackground } from "@/components/visual/MeshBackground";
import { IntroLoader } from "@/components/motion/IntroLoader";
import { Reveal } from "@/components/ui/Reveal";
import {
  Brain,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="dark relative isolate overflow-hidden min-h-dvh bg-[#0A0F1C] text-[var(--cb-text)]">
      {/* Continuous blended mesh — the whole page floats on one mixed-color canvas */}
      <MeshBackground />

      <IntroLoader />
      <PublicNav />

      {/* ───────────────────────── HERO — Memory Core over the mesh ───────────────────────── */}
      <section className="relative overflow-hidden min-h-[92vh] flex items-center">
        {/* The Memory Core — columns 6–12, bleeding off the right edge */}
        <div className="absolute inset-y-0 right-0 w-full lg:w-[58%] -mr-[6%] lg:-mr-[4%] z-0">
          <MemoryCore />
        </div>

        {/* Headline — columns 1–6, left-aligned */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 pt-24 pb-16">
          <div className="max-w-xl lg:max-w-[46%]">
            <div className="flex items-center gap-3 mb-8 animate-enter">
              <span className="label-mono text-[#38BDF8]">001 / MEMORY</span>
              <span className="h-px w-10 bg-white/20" />
              <span className="label-mono text-white/40">v0.1</span>
            </div>

            <h1 className="font-display font-medium text-[clamp(2.75rem,6vw,5.5rem)] leading-[0.96] tracking-[-0.03em] text-white animate-enter" style={{ animationDelay: "0.1s" }}>
              Nothing your
              <br />
              team decided
              <br />
              <span className="text-[#38BDF8]">is ever lost.</span>
            </h1>

            <p className="mt-8 max-w-md text-[18px] leading-[1.6] text-white/55 animate-enter" style={{ animationDelay: "0.2s" }}>
              The memory layer for your codebase. Company Brain remembers every
              decision your engineers made — and stops the PR that breaks one
              before a human ever looks.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3 animate-enter" style={{ animationDelay: "0.3s" }}>
              <a
                href="/app"
                className="btn-mesh group inline-flex items-center justify-center gap-2 font-semibold px-6 py-3.5 rounded-xl focus-visible:ring-2 focus-visible:ring-[#38BDF8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F1C]"
              >
                Connect a repo
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </a>
              <a
                href="/demo"
                className="inline-flex items-center justify-center gap-2 text-white font-medium px-6 py-3.5 rounded-xl border border-white/15 hover:border-white/40 hover:bg-white/5 backdrop-blur-sm transition-colors"
              >
                See it work
                <ArrowUpRight size={16} className="opacity-50" />
              </a>
            </div>

            {/* mono stat ledger */}
            <dl className="mt-12 flex flex-wrap gap-x-8 gap-y-3 animate-enter" style={{ animationDelay: "0.4s" }}>
              {[
                ["41", "decisions held"],
                ["14", "conflicts caught"],
                ["23h", "review saved"],
              ].map(([v, l]) => (
                <div key={l} className="flex items-baseline gap-2">
                  <dt className="font-mono text-2xl font-semibold text-white tabular-nums">{v}</dt>
                  <dd className="label-mono text-white/35">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ───────────────────────── §01 HOW IT WORKS ───────────────────────── */}
      <section aria-labelledby="how-heading" className="relative px-5 sm:px-8 py-24 lg:py-32">
        <div className="max-w-7xl mx-auto">
          <Reveal className="flex items-baseline gap-4 mb-16">
            <span className="label-mono text-[var(--primary)] pt-2">§01</span>
            <h2 id="how-heading" className="font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02] tracking-[-0.03em] max-w-2xl">
              It learns the way an engineer would — by reading the history.
            </h2>
          </Reveal>

          <div className="rule">
            {[
              {
                n: "01",
                title: "Connect a repo",
                desc: "Install the GitHub App. Company Brain reads your merged PRs, reviews, and docs from day one — no setup, no manual rules.",
                meta: "github · live",
              },
              {
                n: "02",
                title: "It extracts the decisions",
                desc: "Every durable choice — rejected approaches, contract rules, security boundaries — becomes a structured, cited record in memory.",
                meta: "41 decisions held",
              },
              {
                n: "03",
                title: "It warns before review",
                desc: "When a PR conflicts with a past decision, it comments first — citing the exact PR where the call was made. Quiet otherwise.",
                meta: "before a human looks",
              },
            ].map((step, i) => (
              <Reveal
                key={step.n}
                delay={i * 90}
                className="group grid md:grid-cols-12 gap-x-8 gap-y-2 items-start py-7 md:py-9 border-b border-[var(--border)] hover:bg-[var(--bg-subtle)] transition-colors -mx-5 sm:-mx-8 px-5 sm:px-8"
              >
                <div className="md:col-span-2 flex md:block items-center justify-between">
                  <span className="font-display text-3xl md:text-5xl font-medium text-[var(--primary)] md:text-[var(--border)] md:group-hover:text-[var(--primary)] transition-colors tabular-nums">
                    {step.n}
                  </span>
                  <span className="md:hidden label-mono text-[var(--text-muted)]">{step.meta}</span>
                </div>
                <div className="md:col-span-7">
                  <h3 className="font-display text-xl md:text-2xl tracking-[-0.02em] mb-1.5">{step.title}</h3>
                  <p className="text-[var(--text-muted)] leading-relaxed max-w-xl">{step.desc}</p>
                </div>
                <div className="hidden md:block md:col-span-3 md:text-right">
                  <span className="label-mono text-[var(--text-muted)]">{step.meta}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── §02 WHY DIFFERENT ───────────────────────── */}
      <section aria-labelledby="diff-heading" className="relative px-5 sm:px-8 py-24 lg:py-32 overflow-hidden">
        {/* unique organic shape accent */}
        <div
          aria-hidden="true"
          className="blob-shape absolute -left-24 top-1/3 w-96 h-96 opacity-30 blur-2xl pointer-events-none"
          style={{ background: "conic-gradient(from 120deg, #38BDF8, #6366F1, #22D3EE, #A78BFA, #38BDF8)" }}
        />
        <div className="relative max-w-7xl mx-auto">
          <Reveal className="flex items-baseline gap-4 mb-4">
            <span className="label-mono text-[var(--primary)] pt-1">§02</span>
            <h2 id="diff-heading" className="font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02] tracking-[-0.03em] max-w-3xl">
              Other reviewers ask if the code is correct.
              <br className="hidden sm:block" />
              <span className="text-[var(--primary)]"> We ask if it&apos;s right for you.</span>
            </h2>
          </Reveal>
          <Reveal delay={80} className="ml-0 sm:ml-12 mb-14 max-w-xl text-[var(--text-muted)] leading-relaxed">
            CodeRabbit and Greptile apply universal best practices — the same for every
            team on earth. Company Brain knows <em className="not-italic text-[var(--cb-text)] font-medium">your</em> rejected
            approaches, <em className="not-italic text-[var(--cb-text)] font-medium">your</em> conventions, the lessons
            <em className="not-italic text-[var(--cb-text)] font-medium"> your</em> team already paid for.
          </Reveal>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Generic */}
            <Reveal from="left" className="glass rounded-2xl p-8 lg:p-10">
              <span className="label-mono text-[var(--text-muted)]">Generic AI reviewers</span>
              <ul className="mt-7 space-y-5">
                {[
                  "Checks if the code is technically correct",
                  "Applies the same playbook to every team",
                  "Has no idea what you already rejected",
                  "Forgets everything the moment the PR closes",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-[var(--text-muted)]">
                    <span className="font-mono text-xs text-[var(--text-muted)]/50 pt-1">—</span>
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>

            {/* Company Brain */}
            <Reveal from="right" delay={120} className="glass relative rounded-2xl p-8 lg:p-10 overflow-hidden">
              <div
                className="absolute -right-16 -top-16 w-56 h-56 blob-shape opacity-40 blur-xl pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(56,189,248,0.6), rgba(99,102,241,0.2), transparent 70%)" }}
                aria-hidden="true"
              />
              <div className="relative">
                <span className="label-mono text-[var(--primary)] flex items-center gap-2">
                  <Brain size={13} /> Company Brain
                </span>
                <ul className="mt-7 space-y-5">
                  {[
                    "Checks if it&apos;s right for this company specifically",
                    "Knows the approaches your team already rejected",
                    "Cites the exact PR where the call was made",
                    "Gets sharper every week it runs — the moat compounds",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-3 text-[var(--cb-text)]">
                      <span className="font-mono text-xs text-[var(--primary)] pt-0.5">+</span>
                      <span dangerouslySetInnerHTML={{ __html: t }} />
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ───────────────────────── §03 THE LAYERS ───────────────────────── */}
      <section aria-labelledby="layers-heading" className="relative z-10 px-5 sm:px-8 py-24 lg:py-32">
        <div className="max-w-7xl mx-auto">
          <Reveal className="flex items-baseline gap-4 mb-4">
            <span className="label-mono text-[var(--primary)] pt-1">§03</span>
            <h2 id="layers-heading" className="font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02] tracking-[-0.03em] max-w-2xl">
              The memory deepens in layers.
            </h2>
          </Reveal>
          <Reveal delay={80} className="ml-0 sm:ml-12 mb-14 max-w-lg text-[var(--text-muted)] leading-relaxed">
            Each source you connect adds context — and makes the warnings fewer, sharper,
            and harder to argue with.
          </Reveal>

          <div className="grid lg:grid-cols-2 gap-x-12 gap-y-px">
            {[
              { n: "01", title: "Code & PR history", desc: "Merged code, diffs, review threads.", status: "Live", on: true },
              { n: "02", title: "Repo docs", desc: "ADRs, README, CONTRIBUTING, /docs.", status: "Connected", on: true },
              { n: "03", title: "Project tools", desc: "Jira, Linear, Notion, Confluence.", status: "Connect", on: false },
              { n: "04", title: "Conversations", desc: "Slack, Discord, meeting notes.", status: "Coming soon", on: false },
            ].map((l, i) => (
              <Reveal
                key={l.n}
                delay={i * 70}
                className={`flex items-center gap-5 py-6 border-b border-[var(--border)] ${!l.on ? "opacity-55" : ""}`}
              >
                <span className="font-mono text-sm text-[var(--text-muted)] tabular-nums">{l.n}</span>
                <span
                  className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                    l.on ? "bg-[var(--primary)] shadow-[0_0_10px_var(--primary)]" : "bg-[var(--border)]"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-xl tracking-[-0.02em]">{l.title}</h3>
                  <p className="text-sm text-[var(--text-muted)] mt-0.5">{l.desc}</p>
                </div>
                <span className="label-mono text-[var(--text-muted)] shrink-0">{l.status}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── CLOSING ───────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 70% 60% at 50% 120%, rgba(56,189,248,0.18), transparent 60%)" }}
        />
        <Reveal className="relative z-10 max-w-3xl mx-auto px-5 sm:px-8 py-28 lg:py-36 text-center">
          <span className="label-mono text-[#38BDF8]">[ The moat ]</span>
          <h2 className="mt-6 font-display text-[clamp(2.25rem,5.5vw,4.5rem)] leading-[0.98] tracking-[-0.035em] text-white">
            Longer used.
            <br />
            Smarter. Stickier.
          </h2>
          <p className="mt-7 max-w-lg mx-auto text-lg text-white/55 leading-relaxed">
            Every PR your team merges makes the memory more precise — and saves the next
            engineer from re-learning a lesson the hard way.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/app"
              className="btn-mesh group inline-flex items-center justify-center gap-2 font-semibold px-7 py-4 rounded-xl"
            >
              Connect a repo
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </a>
            <a
              href="/demo"
              className="inline-flex items-center justify-center gap-2 text-white font-medium px-7 py-4 rounded-xl border border-white/15 hover:border-white/40 hover:bg-white/5 backdrop-blur-sm transition-colors"
            >
              See a demo workspace
            </a>
          </div>
        </Reveal>
      </section>

      {/* ───────────────────────── FOOTER ───────────────────────── */}
      <footer className="relative px-5 sm:px-8 py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-[var(--primary)] flex items-center justify-center">
              <Brain size={13} className="text-white" />
            </div>
            <span className="font-display font-semibold tracking-[-0.02em]">Company Brain</span>
          </div>
          <p className="label-mono text-[var(--text-muted)]">Engineering memory for teams that ship</p>
          <div className="flex gap-6 label-mono">
            <a href="/demo" className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">Demo</a>
            <a href="/app" className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">App</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
