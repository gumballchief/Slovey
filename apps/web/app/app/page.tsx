"use client";

import { useEffect, useState } from "react";
import type { CheckedPR, Decision } from "@/lib/data";
import { useRepo } from "@/app/app/RepoProvider";
import { fetchDecisions, fetchPRs } from "@/lib/api-client";
import { Stat } from "@/components/ui/Stat";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConnectRepoButton } from "@/components/ui/ConnectRepoButton";
import { ReconnectGitHubButton } from "@/components/ui/ReconnectGitHubButton";
import { VerdictPill } from "@/components/ui/VerdictPill";
import { GitPullRequest, AlertTriangle, Clock } from "lucide-react";
import { LogoGlyph } from "@/components/ui/Logo";
import { formatRelativeTime } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function OverviewPage() {
  const { activeRepo: repo, activeRepoId } = useRepo();
  const [recent, setRecent] = useState<CheckedPR[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchPRs(activeRepoId).then((prs) => !cancelled && setRecent(prs.slice(0, 6)));
    fetchDecisions(activeRepoId).then((d) => !cancelled && setDecisions(d));
    return () => {
      cancelled = true;
    };
  }, [activeRepoId]);

  if (!repo) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <EmptyState
          icon={<LogoGlyph size={22} />}
          title="No repository connected yet"
          description="Install the Slovey GitHub App on a repository and it shows up here within a minute. Just installed it? Hit Reconnect to re-sync right away."
          action={
            <div className="flex flex-col items-center gap-2.5 sm:flex-row">
              <ConnectRepoButton />
              <ReconnectGitHubButton />
            </div>
          }
        />
      </div>
    );
  }

  // First run: repo is connected but nothing has been indexed or checked yet.
  // Without this, a brand-new repo shows "0 decisions" over an empty chart and
  // reads as broken. Guide the user to their first decisions instead.
  if (repo.decisionsCount === 0 && repo.prsChecked === 0) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-6">
          <span className="label-mono flex items-center gap-2 text-[var(--primary-strong)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--primary)]" /> {repo.name} · connected
          </span>
          <h2 className="mt-2 font-display text-[1.7rem] font-semibold tracking-[-0.02em] text-[var(--cb-text)]">
            Building this repo&apos;s memory
          </h2>
          <p className="mt-1 max-w-lg text-sm leading-relaxed text-[var(--text-muted)]">
            Slovey is scanning your merged PRs and docs for the decisions your team already
            made. This runs in the background on connect and can take a few minutes on a large
            history — decisions will appear here as they&apos;re found.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { n: "1", t: "History is indexing", d: "Merged PRs, review threads, and /docs are being read now. No action needed." },
            { n: "2", t: "Add a decision yourself", d: "Know a rule already? Record it on the Memory page so the gate enforces it today.", href: "/app/memory" },
            { n: "3", t: "Wire up Preflight", d: "Point your coding agent's MCP config at this repo so checks run before every commit.", href: "/app/preflight" },
          ].map((s) => (
            <a
              key={s.n}
              href={s.href ?? undefined}
              className={`card p-5 ${s.href ? "transition-colors hover:border-[var(--primary)]/40" : "cursor-default"}`}
            >
              <span className="label-mono text-[var(--primary)]">Step {s.n}</span>
              <h3 className="mt-2 font-display text-base tracking-[-0.02em] text-[var(--cb-text)]">{s.t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">{s.d}</p>
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header band — clean Sui accent */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(79,126,247,0.16), transparent 70%)" }}
        />
        <div className="relative">
          <span className="label-mono flex items-center gap-2 text-[var(--primary-strong)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-clear)]" /> {repo.name} · synced
          </span>
          <h2 className="mt-2 font-display text-[1.7rem] font-semibold tracking-[-0.02em] text-[var(--cb-text)]">
            {repo.decisionsCount} decisions in memory
          </h2>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
            Slovey is watching this repo — recent activity and caught conflicts below.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        <Stat
          label="Decisions Remembered"
          value={repo.decisionsCount}
          trend="in memory"
          icon={<LogoGlyph size={16} />}
        />
        <Stat
          label="PRs Checked"
          value={repo.prsChecked}
          trend="last 30 days"
          icon={<GitPullRequest size={16} />}
        />
        <Stat
          label="Conflicts Caught"
          value={repo.conflictsCaught}
          trend="before review"
          trendUp
          icon={<AlertTriangle size={16} />}
        />
        <Stat
          label="Review Time Saved"
          value={repo.reviewTimeSaved}
          trend="estimated"
          trendUp
          icon={<Clock size={16} />}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Trend chart */}
        <div className="lg:col-span-2 card p-5">
          <h2 className="text-sm font-semibold text-[var(--cb-text)] mb-4">
            Weekly Check Activity
          </h2>
          <div aria-label="Weekly check activity chart" className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={repo.trend} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="clearGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-clear)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--color-clear)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="conflictGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-conflict)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--color-conflict)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "var(--cb-text)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="clears"
                  name="Clear"
                  stroke="var(--color-clear)"
                  strokeWidth={2}
                  fill="url(#clearGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="conflicts"
                  name="Conflicts"
                  stroke="var(--color-conflict)"
                  strokeWidth={2}
                  fill="url(#conflictGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Memory preview */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-[var(--cb-text)] mb-4">
            Top Decisions
          </h2>
          <ul className="space-y-3">
            {decisions.slice(0, 4).map((d) => (
              <li key={d.id} className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] mt-1.5 shrink-0" />
                <p className="text-xs text-[var(--cb-text)] leading-relaxed line-clamp-2">
                  {d.decision}
                </p>
              </li>
            ))}
          </ul>
          <a
            href="/app/memory"
            className="mt-4 block text-xs text-[var(--primary)] hover:underline"
          >
            View all {repo.decisionsCount} decisions →
          </a>
        </div>
      </div>

      {/* Recent checks */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--cb-text)]">Recent Checks</h2>
          <a href="/app/pull-requests" className="text-xs text-[var(--primary)] hover:underline">
            View all →
          </a>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {recent.map((pr) => (
            <a
              key={pr.number}
              href={`/app/pull-requests#${pr.number}`}
              className="relative flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--bg-subtle)] transition-colors group"
            >
              <span
                aria-hidden="true"
                className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                  pr.verdict === "conflict" ? "bg-[var(--color-conflict)]" : "bg-[#10B981]"
                } opacity-0 group-hover:opacity-100 transition-opacity`}
              />
              <VerdictPill verdict={pr.verdict} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[var(--text-muted)]">
                    #{pr.number}
                  </span>
                  <span className="text-sm text-[var(--cb-text)] truncate group-hover:text-[var(--primary)] transition-colors">
                    {pr.title}
                  </span>
                </div>
                {pr.matchedDecision && (
                  <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                    Matched: {pr.matchedDecision.slice(0, 60)}…
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs text-[var(--text-muted)] hidden sm:block">
                  @{pr.author}
                </span>
                <span className="text-xs text-[var(--text-muted)] block">
                  {formatRelativeTime(pr.checkedAt)}
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
