"use client";

import "./review.css";
import { CheckIcon, StackIcon, XIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchReviewQueue, reviewDecision, type ReviewItem } from "@/lib/api-client";
import { EvidenceList, SOURCE_LABEL } from "@/features/refs";
import { NeedsRepo, Page } from "@/features/shell/Page";
import { useRepo } from "@/features/shell/RepoProvider";
import { useData } from "@/features/use-data";
import { Badge, Button, Empty, ErrorState, Kbd, Modal, RowsSkeleton, errorMessage, timeAgo } from "@/ui/kit";

const NUM = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

export function Reviews() {
  return <NeedsRepo>{(repoId) => <ReviewsFor repoId={repoId} />}</NeedsRepo>;
}

function ReviewsFor({ repoId }: { repoId: string }) {
  const { repo, refreshReviewCount } = useRepo();
  const queue = useData(repoId, () => fetchReviewQueue(repoId));
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);
  const [rejecting, setRejecting] = useState<ReviewItem | null>(null);
  const [reason, setReason] = useState("");

  const items = queue.data ?? [];
  const current = items[Math.min(index, Math.max(0, items.length - 1))];

  const decide = useCallback(
    async (item: ReviewItem, action: "approve" | "reject", why?: string) => {
      setBusy(action);
      try {
        await reviewDecision(repoId, item.id, action, why);
        queue.mutate((prev) => (prev ?? []).filter((x) => x.id !== item.id));
        refreshReviewCount();
        toast.success(action === "approve" ? "Approved. Slovey enforces it now." : "Rejected. Slovey won't use it.");
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        setBusy(null);
      }
    },
    [repoId, queue, refreshReviewCount],
  );

  // A approve, R reject, J/K or arrows to move.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey || !current || busy || rejecting) return;
      const k = e.key.toLowerCase();
      if (k === "a") {
        e.preventDefault();
        void decide(current, "approve");
      } else if (k === "r") {
        e.preventDefault();
        setRejecting(current);
      } else if (k === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => Math.min(items.length - 1, i + 1));
      } else if (k === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, busy, rejecting, items.length, decide]);

  const count = items.length;
  return (
    <Page
      eyebrow="Reviews"
      title={
        queue.data ? (
          count === 0 ? (
            <>
              All caught up. <span className="dim">Nothing waits for you.</span>
            </>
          ) : (
            <>
              {NUM[count] ?? count} {count === 1 ? "decision waits" : "decisions wait"} <span className="dim">for you.</span>
            </>
          )
        ) : (
          "Reviews"
        )
      }
      intro="Slovey learned these from your pull requests and docs, and it already checks changes against them. Approve the ones your team stands behind; reject any it got wrong and it stops using them."
    >
      {queue.loading && <RowsSkeleton rows={4} />}
      {queue.error != null && <ErrorState error={queue.error} onRetry={queue.reload} title="The review queue didn't load" />}
      {queue.data && count === 0 && (
        <Empty icon={<StackIcon size={22} />} title="Nothing to review">
          New decisions show up here as Slovey learns them from merged and rejected pull requests.
        </Empty>
      )}
      {current && (
        <div className="rv">
          <article className="rv-card ui-card ui-card--raised" aria-live="polite">
            <div className="rv-meta">
              <Badge tone={current.importance === "high" ? "red" : current.importance === "low" ? undefined : "blue"}>
                {current.importance} importance
              </Badge>
              <span className="ui-small">
                {SOURCE_LABEL[current.source] ?? current.source} · learned {timeAgo(current.createdAt)} · {Math.round(current.confidence * 100)}% sure
              </span>
            </div>
            <h2 className="ui-title ui-title--md">{current.decision}</h2>
            {current.why && <p className="ui-body rv-why">{current.why}</p>}
            {current.evidence.length > 0 && (
              <div className="rv-evidence">
                <span className="ui-label">Where it came from</span>
                <EvidenceList evidence={current.evidence} repoName={repo?.name} max={8} />
              </div>
            )}
            <div className="rv-actions">
              <Button
                variant="light"
                size="lg"
                loading={busy === "approve"}
                icon={<CheckIcon size={16} weight="bold" />}
                onClick={() => decide(current, "approve")}
              >
                Approve <Kbd>A</Kbd>
              </Button>
              <Button size="lg" loading={busy === "reject"} icon={<XIcon size={16} />} onClick={() => setRejecting(current)}>
                Reject <Kbd>R</Kbd>
              </Button>
              <span className="ui-small rv-pos">
                {Math.min(index, count - 1) + 1} of {count} · <Kbd>J</Kbd> <Kbd>K</Kbd> to move
              </span>
            </div>
          </article>

          {count > 1 && (
            <ol className="rv-list">
              {items.map((it, i) => (
                <li key={it.id}>
                  <button type="button" className="rv-item" data-on={it.id === current.id} onClick={() => setIndex(i)}>
                    <span className="n">{i + 1}</span>
                    <span className="t">{it.decision}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <Modal
        open={rejecting != null}
        onOpenChange={(v) => {
          if (!v) {
            setRejecting(null);
            setReason("");
          }
        }}
        title="Reject this decision?"
        description="Slovey stops using it. A short reason helps it learn what your team doesn't want."
        actions={
          <>
            <Button onClick={() => setRejecting(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy === "reject"}
              onClick={async () => {
                if (!rejecting) return;
                await decide(rejecting, "reject", reason.trim() || undefined);
                setRejecting(null);
                setReason("");
              }}
            >
              Reject
            </Button>
          </>
        }
      >
        <label className="ui-field">
          <span>Reason (optional)</span>
          <input
            className="ui-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="We reversed this in the Q3 rewrite"
            autoFocus
          />
        </label>
      </Modal>
    </Page>
  );
}
