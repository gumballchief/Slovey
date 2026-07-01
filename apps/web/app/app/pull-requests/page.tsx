"use client";

import { useEffect, useMemo, useState } from "react";
import type { CheckedPR, Decision } from "@/lib/data";
import { useRepo } from "@/app/app/RepoProvider";
import { fetchDecisions, fetchPRs } from "@/lib/api-client";
import { VerdictPill } from "@/components/ui/VerdictPill";
import { SearchInput } from "@/components/ui/SearchInput";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

export default function PullRequestsPage() {
  const { activeRepoId } = useRepo();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "conflict" | "clear">("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [prs, setPrs] = useState<CheckedPR[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchPRs(activeRepoId).then((p) => !cancelled && setPrs(p));
    fetchDecisions(activeRepoId).then((d) => !cancelled && setDecisions(d));
    return () => {
      cancelled = true;
    };
  }, [activeRepoId]);

  const filtered = useMemo(() => {
    return prs.filter((pr) => {
      const matchesQuery =
        !query ||
        pr.title.toLowerCase().includes(query.toLowerCase()) ||
        String(pr.number).includes(query) ||
        pr.author.toLowerCase().includes(query.toLowerCase());
      const matchesFilter = filter === "all" || pr.verdict === filter;
      return matchesQuery && matchesFilter;
    }).sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());
  }, [prs, query, filter]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          placeholder="Search PRs, authors, titles…"
          value={query}
          onChange={setQuery}
          className="flex-1"
        />
        <div className="flex gap-1 shrink-0">
          {(["all", "conflict", "clear"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium capitalize transition-colors cursor-pointer ${
                filter === f
                  ? "bg-[var(--primary)] text-[var(--on-primary)]"
                  : "bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--cb-text)] border border-[var(--border)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        {filtered.length} PR{filtered.length !== 1 ? "s" : ""} checked
      </p>

      {/* PR list */}
      <div className="space-y-2 stagger" key={query + filter}>
        {filtered.map((pr) => {
          const isExpanded = expanded === pr.number;
          const matchedDecision = pr.matchedDecisionId
            ? decisions.find((d) => d.id === pr.matchedDecisionId)
            : null;

          return (
            <div
              key={pr.number}
              id={String(pr.number)}
              className="card overflow-hidden border-l-2"
              style={{ borderLeftColor: pr.verdict === "conflict" ? "#F43F5E" : "#10B981" }}
            >
              {/* Row */}
              <button
                onClick={() => setExpanded(isExpanded ? null : pr.number)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[var(--bg-subtle)] transition-colors text-left cursor-pointer"
                aria-expanded={isExpanded}
              >
                <VerdictPill verdict={pr.verdict} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-[var(--text-muted)] shrink-0">
                      #{pr.number}
                    </span>
                    <span className="text-sm font-medium text-[var(--cb-text)] truncate">
                      {pr.title}
                    </span>
                    {pr.severity && (
                      <span
                        className={`text-2xs font-medium px-1.5 py-0.5 rounded shrink-0 capitalize ${
                          pr.severity === "critical" || pr.severity === "high"
                            ? "bg-[#F43F5E]/10 text-[#F43F5E]"
                            : pr.severity === "medium"
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                        }`}
                      >
                        {pr.severity}
                      </span>
                    )}
                  </div>
                  {pr.matchedDecision && (
                    <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                      Conflicts with: {pr.matchedDecision.slice(0, 70)}…
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-xs text-[var(--text-muted)]">@{pr.author}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {formatRelativeTime(pr.checkedAt)}
                  </p>
                </div>
                {pr.verdict === "conflict" && (
                  isExpanded ? (
                    <ChevronUp size={14} className="text-[var(--text-muted)] shrink-0" />
                  ) : (
                    <ChevronDown size={14} className="text-[var(--text-muted)] shrink-0" />
                  )
                )}
              </button>

              {/* Expanded: PR vs Decision side-by-side */}
              {isExpanded && pr.verdict === "conflict" && matchedDecision && (
                <div className="border-t border-[var(--border)] p-5">
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* PR side */}
                    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-red-500/5 border-b border-red-500/10">
                        <span className="w-2 h-2 rounded-full bg-red-400" />
                        <span className="text-xs font-mono text-red-400">
                          PR #{pr.number}
                        </span>
                        <span className="text-xs text-[var(--text-muted)] truncate">
                          {pr.title}
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                          This PR introduces changes that conflict with a past team decision.
                        </p>
                        <p className="mt-2 text-xs font-mono text-[var(--cb-text)] bg-[var(--bg-subtle)] rounded px-2 py-1.5">
                          Author: @{pr.author}
                        </p>
                      </div>
                    </div>

                    {/* Decision side */}
                    <div className="rounded-lg border border-amber-500/20 overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/5 border-b border-amber-500/10">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="text-xs font-medium text-amber-500">
                          Past Decision
                        </span>
                        {pr.citation && (
                          <span className="font-mono text-xs text-amber-400 ml-auto">
                            {pr.citation}
                          </span>
                        )}
                      </div>
                      <div className="p-3 space-y-2">
                        <p className="text-xs font-semibold text-[var(--cb-text)] leading-snug">
                          {matchedDecision.decision}
                        </p>
                        {matchedDecision.why && (
                          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                            {matchedDecision.why}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {matchedDecision.evidence.map((ev) => (
                            <span
                              key={ev}
                              className="font-mono text-2xs bg-[var(--primary-soft)] text-[var(--primary)] px-1.5 py-0.5 rounded flex items-center gap-1"
                            >
                              <ExternalLink size={9} />
                              {ev}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Suggested fix */}
                  {pr.suggestedFix && (
                    <div className="mt-4 rounded-lg border border-[var(--primary)]/20 bg-[var(--primary-soft)]/40 p-3">
                      <p className="text-2xs font-medium text-[var(--primary)] uppercase tracking-wide mb-1">
                        Suggested fix
                      </p>
                      <p className="text-xs text-[var(--cb-text)] leading-relaxed">
                        {pr.suggestedFix}
                      </p>
                    </div>
                  )}

                  {/* Posted comment */}
                  {pr.postedComment && (
                    <div className="mt-4 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)] p-4">
                      <p className="text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wide">
                        Comment posted to PR
                      </p>
                      <pre className="text-xs text-[var(--cb-text)] whitespace-pre-wrap font-mono leading-relaxed">
                        {pr.postedComment}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
