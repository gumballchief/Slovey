"use client";

import { ArrowSquareOutIcon, CheckIcon, GitPullRequestIcon, ProhibitIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import { fetchPR, fetchPRs, postFeedback, type PRDetail } from "@/lib/api-client";
import type { CheckedPR } from "@/lib/data";
import { EvidenceList, prUrl } from "@/features/refs";
import { NeedsRepo, Page } from "@/features/shell/Page";
import { useRepo } from "@/features/shell/RepoProvider";
import { useData } from "@/features/use-data";
import { Badge, Button, Chip, Empty, ErrorState, Ref, RowsSkeleton, Sheet, Skeleton, errorMessage, feedTime } from "@/ui/kit";

type Filter = "all" | "conflict" | "clear";

export function PullRequests() {
  return (
    <Page
      eyebrow="Pull requests"
      title={
        <>
          Every pull request, <span className="dim">checked.</span>
        </>
      }
      intro="Slovey reads each pull request as it opens or updates and checks it against your decisions. Blocked ones get a comment on GitHub that cites the decision and where it came from."
    >
      <NeedsRepo>{(repoId) => <PullsFor repoId={repoId} />}</NeedsRepo>
    </Page>
  );
}

function PullsFor({ repoId }: { repoId: string }) {
  const { repo } = useRepo();
  const prs = useData(repoId, () => fetchPRs(repoId));
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<CheckedPR | null>(null);
  const list = prs.data ?? [];
  const shown = filter === "all" ? list : list.filter((p) => p.verdict === filter);
  const blocked = list.filter((p) => p.verdict === "conflict").length;

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <Chip on={filter === "all"} count={list.length} onClick={() => setFilter("all")}>All</Chip>
        <Chip on={filter === "conflict"} count={blocked} onClick={() => setFilter("conflict")}>Blocked</Chip>
        <Chip on={filter === "clear"} count={list.length - blocked} onClick={() => setFilter("clear")}>Clear</Chip>
      </div>
      {prs.loading && <RowsSkeleton rows={6} />}
      {prs.error != null && <ErrorState error={prs.error} onRetry={prs.reload} title="Pull requests didn't load" />}
      {prs.data && shown.length === 0 && (
        <Empty icon={<GitPullRequestIcon size={22} />} title={list.length ? "None in this view" : "No pull requests checked yet"}>
          {list.length
            ? "Try another filter."
            : "Open a pull request in this repository and Slovey checks it within a minute or two."}
        </Empty>
      )}
      {shown.length > 0 && (
        <ul className="ui-rows" style={{ maxWidth: 900 }}>
          {shown.map((p) => {
            const isBlocked = p.verdict === "conflict";
            return (
              <li key={`${p.number}-${p.checkedAt}`}>
                <button type="button" className="ui-row" data-active={open?.number === p.number} onClick={() => setOpen(p)}>
                  <span className="ui-row-icon" data-tone={isBlocked ? "red" : "green"}>
                    {isBlocked ? <ProhibitIcon size={17} weight="bold" /> : <CheckIcon size={17} weight="bold" />}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span className="ui-row-title" style={{ display: "block" }}>{p.title}</span>
                    <span className="ui-row-sub">
                      <Ref>#{p.number}</Ref> by {p.author}
                      {isBlocked && p.matchedDecision && <> · breaks “{clip(p.matchedDecision, 70)}”</>}
                      {isBlocked && p.severity && <Badge tone={p.severity === "high" || p.severity === "critical" ? "red" : "amber"}>{p.severity}</Badge>}
                    </span>
                  </span>
                  <span className="ui-row-time">{feedTime(p.checkedAt)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <PrSheet pr={open} repoId={repoId} repoName={repo?.name} onClose={() => setOpen(null)} onChanged={prs.reload} />
    </>
  );
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function PrSheet({
  pr,
  repoId,
  repoName,
  onClose,
  onChanged,
}: {
  pr: CheckedPR | null;
  repoId: string;
  repoName?: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const detail = useData(pr ? `${repoId}|${pr.number}` : null, () => fetchPR(repoId, pr!.number));
  const [busy, setBusy] = useState<null | "dismiss" | "confirm">(null);
  if (!pr) return <Sheet open={false} onOpenChange={() => onClose()} title="Pull request">{null}</Sheet>;
  const d: PRDetail = detail.data ?? pr;
  const blocked = pr.verdict === "conflict";

  async function feedback(action: "dismiss" | "confirm") {
    setBusy(action);
    try {
      await postFeedback(repoId, { prNumber: pr!.number, decisionId: pr!.matchedDecisionId, action });
      toast.success(action === "dismiss" ? "Marked as a false alarm. Slovey learns from it." : "Confirmed. The block stands.");
      onChanged();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(v) => !v && onClose()}
      title={`PR #${pr.number}`}
      head={
        <>
          {blocked ? <Badge tone="red" dot>Blocked</Badge> : <Badge tone="green" dot>Clear</Badge>}
          <strong style={{ color: "var(--ink)" }}>PR #{pr.number}</strong>
        </>
      }
      footer={
        blocked ? (
          <>
            <Button variant="light" wide loading={busy === "confirm"} onClick={() => feedback("confirm")} icon={<CheckIcon size={15} />}>
              Keep the block
            </Button>
            <Button loading={busy === "dismiss"} onClick={() => feedback("dismiss")} icon={<XIcon size={15} />}>
              False alarm
            </Button>
          </>
        ) : (
          <a className="ui-btn ui-btn--wide" href={prUrl(repoName, pr.number)} target="_blank" rel="noreferrer">
            Open on GitHub <ArrowSquareOutIcon size={15} />
          </a>
        )
      }
    >
      <section className="ui-section">
        <div className="ui-label">The change</div>
        <div className="ui-h3">{d.title}</div>
        <div className="ui-small">
          by {d.author} · checked {feedTime(d.checkedAt)} ·{" "}
          <a href={prUrl(repoName, pr.number)} target="_blank" rel="noreferrer" style={{ color: "var(--ice)" }}>
            open on GitHub
          </a>
        </div>
      </section>
      {detail.loading && <Skeleton h={90} />}
      {blocked && (d.matchedDecision || d.decision) && (
        <section className="ui-section">
          <div className="ui-label">The decision it breaks</div>
          <div className="ui-card ui-card--pad" style={{ borderColor: "rgba(61,123,255,.28)", background: "linear-gradient(180deg, rgba(61,123,255,.1), rgba(14,17,34,.9))" }}>
            <div className="ui-title ui-title--sm">{d.decision?.decision ?? d.matchedDecision}</div>
            {(d.decision?.why || d.citation) && <p className="ui-body" style={{ marginTop: 10 }}>{d.decision?.why || d.citation}</p>}
          </div>
          {d.decision?.evidence?.length ? <EvidenceList evidence={d.decision.evidence} repoName={repoName} /> : null}
        </section>
      )}
      {blocked && d.suggestedFix && (
        <section className="ui-section">
          <div className="ui-label">Suggested fix</div>
          <p className="ui-body">{d.suggestedFix}</p>
        </section>
      )}
      {d.postedComment && (
        <section className="ui-section">
          <div className="ui-label">Comment posted on GitHub</div>
          <pre className="ui-code" style={{ whiteSpace: "pre-wrap" }}>{d.postedComment}</pre>
        </section>
      )}
    </Sheet>
  );
}
