"use client";

import { useEffect, useState } from "react";
import type { CheckedPR, Decision } from "@/lib/data";
import { useRepo } from "@/app/app/RepoProvider";
import { fetchDecisions, fetchPRs } from "@/lib/api-client";
import { Stat } from "@/components/ui/Stat";
import { EmptyState } from "@/components/ui/EmptyState";
import { VerdictPill } from "@/components/ui/VerdictPill";
import { CorePoster } from "@/components/core/MemoryCore";
import { Brain, GitPullRequest, AlertTriangle, Clock } from "lucide-react";
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
          icon={<Brain size={22} />}
          title="No repository connected"
          description="Install the GitHub App on a repository to start capturing decisions — or import existing ADRs from the Memory page."
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header band — ambient Core motif (calm, static) */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-5">
        <div className="absolute -right-8 -top-10 w-48 h-48 opacity-30 pointer-events-none hidden sm:block">
          <CorePoster />
        </div>
        <div className="relative">
          <span className="label-mono text-[var(--primary)]">{repo.name} · synced</span>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-[var(--cb-text)] mt-1">
            {repo.decisionsCount} decisions in memory
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1 max-w-md">
            Company Brain is watching this repo. Recent activity and caught conflicts below.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        <Stat
          label="Decisions Remembered"
          value={repo.decisionsCount}
          trend={`+${Math.round(repo.decisionsCount * 0.12)} this month`}
          trendUp
          icon={<Brain size={16} />}
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
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="conflictGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
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
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#clearGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="conflicts"
                  name="Conflicts"
                  stroke="#F43F5E"
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
                  pr.verdict === "conflict" ? "bg-[#F43F5E]" : "bg-[#10B981]"
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
