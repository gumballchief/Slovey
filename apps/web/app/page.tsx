import { PublicNav } from "@/components/layout/PublicNav";
import { Reveal } from "@/components/ui/Reveal";
import { ArrowRight, ArrowUpRight, Check, Quote, GitPullRequest } from "lucide-react";

/**
 * Landing — "Current". Sui-inspired: deep-ocean navy, sea-blue signal, airy
 * hierarchy. The hero's intent-driven imagery is a real decision record (the
 * product), not decoration. Motion whispers; everything respects reduced-motion.
 */
export default function LandingPage() {
  return (
    <div className="dark relative isolate min-h-dvh overflow-hidden bg-[var(--bg)] text-[var(--cb-text)]">
      {/* Ambient current — a soft aqua wash + drifting gradient lines behind the hero */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[820px] overflow-hidden">
        <div
          className="absolute left-1/2 top-[-340px] h-[760px] w-[1200px] -translate-x-1/2 blur-[30px]"
          style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(77,162,255,0.18), rgba(77,162,255,0.04) 55%, transparent 72%)" }}
        />
        <Current />
      </div>

      <PublicNav />

      {/* ───────── HERO ───────── */}
      <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:pt-24">
        <div>
          <Reveal className="mb-7 flex items-center gap-3">
            <span className="label-mono text-[var(--primary)]">Engineering memory</span>
            <span className="h-px w-8 bg-white/20" />
            <span className="label-mono text-white/40">v0.1</span>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="font-display text-[clamp(2.6rem,6vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-white">
              Nothing your team
              <br />
              decided is ever
              <br />
              <span className="text-[var(--primary)]">lost again.</span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="mt-7 max-w-md text-[17px] leading-[1.65] text-white/60">
              Company Brain remembers every engineering decision your team has made — the
              rules, the tradeoffs, the approaches you already rejected — and warns the PR
              that breaks one, before a human ever looks.
            </p>
          </Reveal>

          <Reveal delay={180} className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href="/app"
              className="btn-mesh group inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              Connect a repo
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="/demo"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-3.5 font-medium text-white backdrop-blur-sm transition-colors hover:border-white/35 hover:bg-white/5"
            >
              See it work
              <ArrowUpRight size={16} className="opacity-50" />
            </a>
          </Reveal>

          <Reveal delay={240} className="mt-10 flex items-center gap-2.5 text-white/45">
            <span className="flex -space-x-1.5">
              {["#4DA2FF", "#8FD0FF", "#2E8AE6"].map((c) => (
                <span key={c} className="h-5 w-5 rounded-full ring-2 ring-[var(--bg)]" style={{ background: c }} />
              ))}
            </span>
            <span className="text-sm">Reads your merged PRs, reviews, and docs from day one.</span>
          </Reveal>
        </div>

        {/* Signature: a real decision record, floating */}
        <Reveal from="right" delay={160} className="relative">
          <DecisionCard />
        </Reveal>
      </section>

      {/* ───────── §01 HOW IT WORKS ───────── */}
      <Section index="§01" title="It learns the way an engineer would — by reading the history.">
        <div className="mt-14 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {[
            { n: "01", t: "Connect a repo", d: "Install the GitHub App. It reads your merged PRs, reviews, and docs from day one — no manual rules to write.", m: "github · live" },
            { n: "02", t: "It extracts the decisions", d: "Every durable choice — rejected approaches, contract rules, security boundaries — becomes a structured, cited record in memory.", m: "cited · structured" },
            { n: "03", t: "It warns before review", d: "When a PR conflicts with a past decision, it comments first — pointing at the exact PR where the call was made. Quiet otherwise.", m: "before a human looks" },
          ].map((s, i) => (
            <Reveal
              key={s.n}
              delay={i * 80}
              className="group -mx-5 grid items-start gap-x-8 gap-y-1 px-5 py-8 transition-colors hover:bg-white/[0.02] sm:-mx-8 sm:px-8 md:grid-cols-12"
            >
              <span className="font-display text-3xl font-medium tabular-nums text-white/20 transition-colors group-hover:text-[var(--primary)] md:col-span-2 md:text-4xl">
                {s.n}
              </span>
              <div className="md:col-span-7">
                <h3 className="font-display text-xl tracking-[-0.02em] text-white md:text-2xl">{s.t}</h3>
                <p className="mt-2 max-w-xl leading-relaxed text-white/55">{s.d}</p>
              </div>
              <span className="label-mono self-center text-white/35 md:col-span-3 md:text-right">{s.m}</span>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ───────── §02 WHY DIFFERENT ───────── */}
      <Section index="§02" title={<>Other reviewers ask if the code is correct.<br className="hidden sm:block" /> <span className="text-[var(--primary)]">We ask if it&apos;s right for you.</span></>}>
        <Reveal delay={80} className="mb-12 max-w-xl leading-relaxed text-white/55 sm:ml-14">
          Generic AI reviewers apply the same universal playbook to every team on earth.
          Company Brain knows <em className="font-medium not-italic text-white">your</em> rejected
          approaches, <em className="font-medium not-italic text-white">your</em> conventions, the
          lessons <em className="font-medium not-italic text-white">your</em> team already paid for.
        </Reveal>
        <div className="grid gap-4 md:grid-cols-2">
          <Reveal from="left" className="rounded-3xl border border-[var(--border)] bg-white/[0.02] p-8 lg:p-10">
            <span className="label-mono text-white/40">Generic AI reviewers</span>
            <ul className="mt-7 space-y-4">
              {["Checks if the code is technically correct", "Applies the same playbook to every team", "Has no idea what you already rejected", "Forgets everything the moment the PR closes"].map((t) => (
                <li key={t} className="flex items-start gap-3 text-white/55">
                  <span className="mt-1.5 font-mono text-xs text-white/25">—</span>
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal from="right" delay={120} className="relative overflow-hidden rounded-3xl border border-[var(--primary)]/25 bg-[var(--primary)]/[0.06] p-8 lg:p-10">
            <span className="label-mono flex items-center gap-2 text-[var(--primary)]">Company Brain</span>
            <ul className="mt-7 space-y-4">
              {["Checks if it's right for this company specifically", "Knows the approaches your team already rejected", "Cites the exact PR where the call was made", "Gets sharper every week it runs — the moat compounds"].map((t) => (
                <li key={t} className="flex items-start gap-3 text-white">
                  <Check size={15} className="mt-0.5 shrink-0 text-[var(--primary)]" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Section>

      {/* ───────── §03 THE LAYERS ───────── */}
      <Section index="§03" title="The memory deepens in layers.">
        <Reveal delay={80} className="mb-12 max-w-lg leading-relaxed text-white/55 sm:ml-14">
          Each source you connect adds context — and makes the warnings fewer, sharper, and
          harder to argue with.
        </Reveal>
        <div className="grid gap-x-12 gap-y-0 lg:grid-cols-2">
          {[
            { n: "01", t: "Code & PR history", d: "Merged code, diffs, review threads.", s: "Live", on: true },
            { n: "02", t: "Repo docs", d: "ADRs, README, CONTRIBUTING, /docs.", s: "Live", on: true },
            { n: "03", t: "Project tools", d: "Jira, Linear, Notion, Confluence.", s: "Connect", on: false },
            { n: "04", t: "Conversations", d: "Slack, Discord, meeting notes.", s: "Soon", on: false },
          ].map((l, i) => (
            <Reveal key={l.n} delay={i * 70} className={`flex items-center gap-5 border-b border-[var(--border)] py-6 ${l.on ? "" : "opacity-50"}`}>
              <span className="font-mono text-sm tabular-nums text-white/40">{l.n}</span>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${l.on ? "bg-[var(--primary)] shadow-[0_0_10px_var(--primary)]" : "bg-white/20"}`} />
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg tracking-[-0.02em] text-white">{l.t}</h3>
                <p className="mt-0.5 text-sm text-white/50">{l.d}</p>
              </div>
              <span className="label-mono shrink-0 text-white/40">{l.s}</span>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ───────── CLOSING ───────── */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 120%, rgba(77,162,255,0.16), transparent 60%)" }} />
        <Reveal className="relative mx-auto max-w-3xl px-5 py-28 text-center sm:px-8 lg:py-36">
          <span className="label-mono text-[var(--primary)]">The moat</span>
          <h2 className="mt-6 font-display text-[clamp(2.25rem,5.5vw,4rem)] font-semibold leading-[1] tracking-[-0.035em] text-white">
            Longer used. Smarter.
            <br />
            Harder to leave.
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-white/55">
            Every PR your team merges makes the memory more precise — and saves the next engineer
            from re-learning a lesson the hard way.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="/app" className="btn-mesh group inline-flex items-center justify-center gap-2 rounded-full px-7 py-4 font-semibold">
              Connect a repo
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </a>
            <a href="/demo" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-7 py-4 font-medium text-white transition-colors hover:border-white/35 hover:bg-white/5">
              See a demo workspace
            </a>
          </div>
        </Reveal>
      </section>

      {/* ───────── FOOTER ───────── */}
      <footer className="border-t border-white/5 px-5 py-12 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-display font-semibold tracking-[-0.02em] text-white">Company Brain</span>
          </div>
          <p className="label-mono text-white/40">Engineering memory for teams that ship</p>
          <div className="flex gap-6">
            <a href="/demo" className="label-mono text-white/50 transition-colors hover:text-[var(--primary)]">Demo</a>
            <a href="/app" className="label-mono text-white/50 transition-colors hover:text-[var(--primary)]">App</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Section shell: mono index + Sora heading, breathing rhythm ── */
function Section({ index, title, children }: { index: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
      <Reveal className="mb-2 flex items-baseline gap-4">
        <span className="label-mono pt-1 text-[var(--primary)]">{index}</span>
        <h2 className="max-w-3xl font-display text-[clamp(1.9rem,4.2vw,3.25rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-white">
          {title}
        </h2>
      </Reveal>
      {children}
    </section>
  );
}

/* ── Signature: a designed decision record (the product, as imagery) ── */
function DecisionCard() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* soft glow */}
      <div aria-hidden className="absolute -inset-6 rounded-[32px] bg-[var(--primary)]/10 blur-3xl" />
      <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl sm:p-7">
        <div className="flex items-center justify-between">
          <span className="label-mono text-white/40">Decision · DEC-0142</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> approved
          </span>
        </div>
        <p className="mt-4 font-display text-lg font-medium leading-snug tracking-[-0.01em] text-white">
          Billing money math must use integer minor units — never floats.
        </p>
        <p className="mt-2.5 flex items-start gap-2 text-sm leading-relaxed text-white/55">
          <Quote size={14} className="mt-0.5 shrink-0 text-[var(--primary)]" />
          Float arithmetic introduced rounding drift in payouts. We standardized on cents.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)]/12 px-2 py-1 font-mono text-xs text-[var(--primary)]">
            <GitPullRequest size={11} /> PR #142
          </span>
          <span className="rounded-md bg-white/5 px-2 py-1 font-mono text-xs text-white/50">ADR-9</span>
          <span className="ml-auto label-mono text-white/30">confidence 0.98</span>
        </div>
        {/* negative knowledge — our edge */}
        <div className="mt-5 rounded-xl border border-white/5 bg-black/20 p-3">
          <span className="label-mono text-white/35">Already rejected</span>
          <p className="mt-1.5 text-sm text-white/60">Storing money as floating-point dollars — turned down twice.</p>
        </div>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--primary)]">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-[var(--on-primary)]">
        <path d="M12 3c-2 0-3.5 1.4-3.7 3.2C6.6 6.7 5.5 8.2 5.5 10c0 .6.1 1.1.3 1.6C4.7 12.3 4 13.5 4 15c0 2.2 1.8 4 4 4 .3 0 .6 0 .9-.1.5 1.2 1.7 2.1 3.1 2.1s2.6-.9 3.1-2.1c.3.1.6.1.9.1 2.2 0 4-1.8 4-4 0-1.5-.7-2.7-1.8-3.4.2-.5.3-1 .3-1.6 0-1.8-1.1-3.3-2.8-3.8C15.5 4.4 14 3 12 3Z" fill="currentColor" />
      </svg>
    </div>
  );
}

/* ── Ambient "current": slow-drifting aqua gradient strokes (whisper) ── */
function Current() {
  return (
    <svg className="absolute inset-x-0 top-10 mx-auto h-[560px] w-full max-w-[1400px] opacity-[0.5]" viewBox="0 0 1400 560" fill="none" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="cur" x1="0" y1="0" x2="1400" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4DA2FF" stopOpacity="0" />
          <stop offset="0.5" stopColor="#8FD0FF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#4DA2FF" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[120, 210, 300, 400].map((y, i) => (
        <path
          key={y}
          d={`M-50 ${y} C 300 ${y - 60}, 500 ${y + 70}, 750 ${y} S 1200 ${y - 70}, 1450 ${y}`}
          stroke="url(#cur)"
          strokeWidth="1.25"
          className="current-line"
          style={{ animationDelay: `${i * 0.6}s` }}
        />
      ))}
    </svg>
  );
}
