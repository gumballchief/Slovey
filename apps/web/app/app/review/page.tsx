"use client";

import { useEffect, useState } from "react";
import { Check, X, ShieldCheck, ExternalLink, Sparkles } from "lucide-react";
import { useRepo } from "@/app/app/RepoProvider";
import { fetchReviewQueue, reviewDecision, type ReviewItem } from "@/lib/api-client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";

const SOURCE_LABELS: Record<string, string> = {
  github_pr: "GitHub PR",
  doc: "Docs",
  linear: "Linear",
  notion: "Notion",
  slack: "Slack",
  jira: "Jira",
  confluence: "Confluence",
  discord: "Discord",
  repo_analysis: "Repo Analysis",
  manual: "Manual",
};

export default function ReviewPage() {
  const { activeRepoId } = useRepo();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetchReviewQueue(activeRepoId)
      .then(setItems)
      .finally(() => setLoading(false));
  }
  useEffect(load, [activeRepoId]);

  async function act(item: ReviewItem, action: "approve" | "reject") {
    let reason: string | undefined;
    if (action === "reject") {
      reason = window.prompt("Why is this being rejected? (recorded as negative knowledge)") ?? undefined;
      if (reason === undefined) return; // cancelled
    }
    setBusy(item.id);
    try {
      await reviewDecision(activeRepoId, item.id, action, reason);
      setItems((xs) => xs.filter((x) => x.id !== item.id)); // optimistic remove
    } catch {
      /* leave in list on failure */
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[var(--primary-soft)] flex items-center justify-center shrink-0">
          <ShieldCheck size={16} className="text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="font-display font-semibold text-lg tracking-[-0.02em] text-[var(--cb-text)] leading-none">
            Review queue
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Confirm what the brain learned. Approving makes it trusted memory; rejecting records it as
            “we decided against this.”
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={22} />}
          title="Nothing to review"
          description="Every learned decision has been confirmed. New decisions appear here as the brain learns them."
        />
      ) : (
        <>
          <p className="text-xs text-[var(--text-muted)]">
            {items.length} decision{items.length !== 1 ? "s" : ""} awaiting review
          </p>
          <ul className="space-y-3">
            {items.map((d) => (
              <li key={d.id} className="card p-5 space-y-3">
                <div className="flex items-start gap-3 justify-between">
                  <p className="text-sm font-semibold text-[var(--cb-text)] leading-snug flex-1">
                    {d.decision}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={d.status === "approved" ? "approved" : "suggested"}>{d.status}</Badge>
                    <Badge variant="default">{SOURCE_LABELS[d.source] ?? d.source}</Badge>
                  </div>
                </div>

                {d.why && <p className="text-sm text-[var(--text-muted)] leading-relaxed">{d.why}</p>}

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {d.evidence.map((ev) => (
                      <span
                        key={ev}
                        className="font-mono text-xs bg-[var(--primary-soft)] text-[var(--primary)] px-2 py-0.5 rounded flex items-center gap-1"
                      >
                        <ExternalLink size={10} />
                        {ev}
                      </span>
                    ))}
                    <span className="text-xs text-[var(--text-muted)] self-center">
                      confidence {d.confidence} · {formatDate(d.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="secondary" size="sm" disabled={busy === d.id} onClick={() => act(d, "reject")}>
                      <X size={13} />
                      Reject
                    </Button>
                    <Button size="sm" disabled={busy === d.id} onClick={() => act(d, "approve")}>
                      <Check size={13} />
                      {busy === d.id ? "Saving…" : "Approve"}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
