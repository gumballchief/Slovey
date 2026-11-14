"use client";

import "./today.css";
import {
  ArrowSquareOutIcon,
  ChatCircleIcon,
  CheckIcon,
  LightbulbIcon,
  ProhibitIcon,
  RobotIcon,
  SealCheckIcon,
  XIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  fetchAgentRuns,
  fetchPreflight,
  postFeedback,
  type AgentRunRow,
  type PreflightRunRow,
} from "@/lib/api-client";
import type { CheckedPR } from "@/lib/data";
import { prUrl } from "@/features/refs";
import { NeedsRepo } from "@/features/shell/Page";
import { useRepo } from "@/features/shell/RepoProvider";
import { useData } from "@/features/use-data";
import { Badge, Button, Chip, ErrorState, Ref, RowsSkeleton, Sheet, Stat, errorMessage, feedTime } from "@/ui/kit";

type Overview = {
  stats: { decisionsCount: number; prsChecked: number; conflictsCaught: number; reviewTimeSaved: string };
  recent: CheckedPR[];
};
type Change = { id: string; decision: string; status: string; updatedAt: string; isNew: boolean };

type Item =
  | { kind: "pr"; at: string; pr: CheckedPR }
  | { kind: "preflight"; at: string; run: PreflightRunRow }
  | { kind: "learned"; at: string; change: Change }
  | { kind: "agent"; at: string; run: AgentRunRow };

type Filter = "all" | "blocked" | "learned" | "agents";

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`.trim());
  return (await res.json()) as T;
}

function isBlocked(i: Item): boolean {
  return (
    (i.kind === "pr" && i.pr.verdict === "conflict") ||
    (i.kind === "preflight" && (i.run.status === "fail" || !i.run.safeToCommit))
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const NUM = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

export function Today() {
  return (
    <main className="app-main">
      <NeedsRepo>{(repoId) => <TodayFor repoId={repoId} />}</NeedsRepo>
    </main>
  );
}

function TodayFor({ repoId }: { repoId: string }) {
  const { me, repo, reviewCount } = useRepo();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Item | null>(null);

  const feed = useData(repoId, async () => {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [overview, preflight, changes, agents] = await Promise.all([
      getJSON<Overview>(`/api/repos/${repoId}/overview`),
      fetchPreflight(repoId).catch(() => ({ runs: [] as PreflightRunRow[] })),
      getJSON<Change[]>(`/api/repos/${repoId}/changes?since=${encodeURIComponent(since)}`).catch(() => [] as Change[]),
      fetchAgentRuns(repoId).catch(() => [] as AgentRunRow[]),
    ]);
    const items: Item[] = [
      ...overview.recent.map((pr) => ({ kind: "pr" as const, at: pr.checkedAt, pr })),
      ...preflight.runs.slice(0, 12).map((run) => ({ kind: "preflight" as const, at: run.createdAt, run })),
      ...changes.filter((c) => c.isNew).slice(0, 12).map((change) => ({ kind: "learned" as const, at: change.updatedAt, change })),
      ...agents.slice(0, 8).map((run) => ({ kind: "agent" as const, at: run.updatedAt, run })),
    ].sort((a, b) => b.at.localeCompare(a.at));
    return { overview, items };
  });

  const items = feed.data?.items ?? [];
  const blockedRecent = useMemo(
    () => items.filter((i) => isBlocked(i) && Date.now() - new Date(i.at).getTime() < 7 * 86_400_000).length,
    [items],
  );
  const shown = items.filter((i) =>
    filter === "all" ? true : filter === "blocked" ? isBlocked(i) : filter === "learned" ? i.kind === "learned" : i.kind === "agent",
  );
  const name = me?.login && me.login !== "dev" ? me.login.split(/[-_ ]/)[0] : null;
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <div className="today-head">
        <div className="ui-eyebrow">{today}</div>
        <h1 className="ui-title today-title">
          {greeting()}
          {name ? `, ${name}` : ""}.{" "}
          <span className="dim">
            {blockedRecent === 0
              ? "Nothing needs you."
              : `${NUM[blockedRecent] ?? blockedRecent} ${blockedRecent === 1 ? "change needs" : "changes need"} you.`}
          </span>
        </h1>
        {feed.data && (
          <div className="ui-stats" style={{ marginTop: 26 }}>
            <Stat n={feed.data.overview.stats.prsChecked} label="changes checked" />
            <Stat n={feed.data.overview.stats.conflictsCaught} label="blocked" tone={feed.data.overview.stats.conflictsCaught ? "red" : undefined} />
            <Stat n={feed.data.overview.stats.decisionsCount} label="decisions learned" />
            <Stat n={reviewCount} label="waiting for review" />
          </div>
        )}
      </div>

      <hr className="ui-hr" style={{ margin: "30px 0 22px" }} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }} role="group" aria-label="Filter">
        <Chip on={filter === "all"} onClick={() => setFilter("all")}>Everything</Chip>
        <Chip on={filter === "blocked"} onClick={() => setFilter("blocked")}>Blocked</Chip>
        <Chip on={filter === "learned"} onClick={() => setFilter("learned")}>Learned</Chip>
        <Chip on={filter === "agents"} onClick={() => setFilter("agents")}>Agents</Chip>
      </div>

      {feed.loading && <RowsSkeleton rows={6} />}
      {feed.error != null && <ErrorState error={feed.error} onRetry={feed.reload} title="Today's activity didn't load" />}
      {feed.data && shown.length === 0 && (
        <div className="ui-empty">
          <div className="ui-h3">{filter === "all" ? "Quiet so far" : "Nothing here yet"}</div>
          <p>
            {filter === "all"
              ? "When a pull request opens or an agent runs Preflight, Slovey checks it and it shows up here."
              : "Nothing in this view from the last 30 days."}
          </p>
        </div>
      )}
      {feed.data && shown.length > 0 && (
        <ul className="ui-rows today-feed">
          {shown.map((i) => (
            <li key={`${i.kind}-${keyOf(i)}`}>
              <FeedRow item={i} repoName={repo?.name} active={open != null && keyOf(open) === keyOf(i)} onOpen={() => setOpen(i)} />
            </li>
          ))}
        </ul>
      )}

      <Detail item={open} repoId={repoId} repoName={repo?.name} onClose={() => setOpen(null)} onChanged={feed.reload} />
    </>
  );
}

function keyOf(i: Item): string {
  return i.kind === "pr" ? `pr${i.pr.number}-${i.pr.checkedAt}` : i.kind === "learned" ? i.change.id : i.run.id;
}

function FeedRow({ item, repoName, active, onOpen }: { item: Item; repoName?: string; active: boolean; onOpen: () => void }) {
  let icon = <LightbulbIcon size={17} />;
  let tone: "red" | "green" | undefined;
  let title = "";
  let sub: React.ReactNode = null;

  if (item.kind === "pr") {
    const blocked = item.pr.verdict === "conflict";
    icon = blocked ? <ProhibitIcon size={17} weight="bold" /> : <CheckIcon size={17} weight="bold" />;
    tone = blocked ? "red" : "green";
    title = item.pr.title;
    sub = (
      <>
        PR <Ref href={prUrl(repoName, item.pr.number)}>#{item.pr.number}</Ref> by {item.pr.author}
        {blocked && item.pr.matchedDecision ? <> breaks “{clip(item.pr.matchedDecision, 60)}”</> : <> passed every decision</>}
      </>
    );
  } else if (item.kind === "preflight") {
    const blocked = item.run.status === "fail" || !item.run.safeToCommit;
    icon = blocked ? <ProhibitIcon size={17} weight="bold" /> : <SealCheckIcon size={17} />;
    tone = blocked ? "red" : "green";
    title = blocked ? "Preflight stopped a commit" : "Preflight passed a commit";
    sub = (
      <>
        on <span className="ui-mono">{item.run.branch ?? "a local branch"}</span>
        {item.run.commitSha && <Ref>{item.run.commitSha.slice(0, 7)}</Ref>}
        {item.run.attempt > 1 && <> · attempt {item.run.attempt}</>}
      </>
    );
  } else if (item.kind === "learned") {
    title = `Learned: ${clip(item.change.decision, 90)}`;
    sub = <>{item.change.status === "approved" ? "Approved decision" : "Waiting for your review"}</>;
  } else {
    icon = <RobotIcon size={17} />;
    tone = item.run.status === "failed" ? "red" : undefined;
    title = clip(item.run.intent, 90);
    sub = (
      <>
        Agent task · {agentStatus(item.run)}
        {item.run.prNumber && <Ref href={item.run.prUrl ?? prUrl(repoName, item.run.prNumber)}>#{item.run.prNumber}</Ref>}
      </>
    );
  }

  return (
    <button type="button" className="ui-row" data-active={active} onClick={onOpen}>
      <span className="ui-row-icon" data-tone={tone}>
        {icon}
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="ui-row-title" style={{ display: "block" }}>{title}</span>
        <span className="ui-row-sub">{sub}</span>
      </span>
      <span className="ui-row-time">{feedTime(item.at)}</span>
    </button>
  );
}

function agentStatus(r: AgentRunRow): string {
  return r.status === "ready" ? "draft PR ready" : r.status === "failed" ? "failed" : r.status === "running" ? "working" : "queued";
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function Detail({
  item,
  repoId,
  repoName,
  onClose,
  onChanged,
}: {
  item: Item | null;
  repoId: string;
  repoName?: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<null | "dismiss" | "confirm">(null);
  if (!item) return <Sheet open={false} onOpenChange={() => onClose()} title="Details">{null}</Sheet>;

  async function feedback(action: "dismiss" | "confirm") {
    if (item?.kind !== "pr") return;
    setBusy(action);
    try {
      await postFeedback(repoId, { prNumber: item.pr.number, decisionId: item.pr.matchedDecisionId, action });
      toast.success(action === "dismiss" ? "Marked as a false alarm. Slovey will learn from it." : "Confirmed. The block stands.");
      onChanged();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (item.kind === "pr") {
    const pr = item.pr;
    const blocked = pr.verdict === "conflict";
    return (
      <Sheet
        open
        onOpenChange={(v) => !v && onClose()}
        title={`PR #${pr.number}`}
        head={
          <>
            {blocked ? (
              <Badge tone="red" dot>Blocked</Badge>
            ) : (
              <Badge tone="green" dot>Clear</Badge>
            )}
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
          <div className="ui-h3">{pr.title}</div>
          <div className="ui-small">
            by {pr.author} · checked {feedTime(pr.checkedAt)} ·{" "}
            <a href={prUrl(repoName, pr.number)} target="_blank" rel="noreferrer" style={{ color: "var(--ice)" }}>
              open on GitHub
            </a>
          </div>
        </section>
        {blocked && pr.matchedDecision && (
          <section className="ui-section">
            <div className="ui-label">The decision it breaks</div>
            <div className="ui-card ui-card--pad today-decision">
              <div className="ui-title ui-title--sm">{pr.matchedDecision}</div>
              {pr.citation && <p className="ui-body" style={{ marginTop: 10 }}>{pr.citation}</p>}
            </div>
          </section>
        )}
        {blocked && pr.suggestedFix && (
          <section className="ui-section">
            <div className="ui-label">Suggested fix</div>
            <p className="ui-body">{pr.suggestedFix}</p>
          </section>
        )}
        {pr.postedComment && (
          <section className="ui-section">
            <div className="ui-label">What Slovey posted on the PR</div>
            <pre className="ui-code" style={{ whiteSpace: "pre-wrap" }}>{pr.postedComment}</pre>
          </section>
        )}
      </Sheet>
    );
  }

  if (item.kind === "preflight") {
    const r = item.run;
    const blocked = r.status === "fail" || !r.safeToCommit;
    return (
      <Sheet
        open
        onOpenChange={(v) => !v && onClose()}
        title="Preflight run"
        head={
          <>
            {blocked ? <Badge tone="red" dot>Blocked</Badge> : <Badge tone="green" dot>Passed</Badge>}
            <strong style={{ color: "var(--ink)" }}>Preflight</strong>
          </>
        }
        footer={
          <Link className="ui-btn ui-btn--light ui-btn--wide" href={`/app/preflight?run=${r.id}`}>
            Open the full run
          </Link>
        }
      >
        <section className="ui-section">
          <div className="ui-label">Summary</div>
          <p className="ui-body">{r.summary || "No summary recorded."}</p>
          <div className="ui-small">
            {r.branch ?? "local branch"} · attempt {r.attempt} of {r.maxAttempts} · {(r.durationMs / 1000).toFixed(1)}s
          </div>
        </section>
        {r.agentInstruction && (
          <section className="ui-section">
            <div className="ui-label">What the agent was told</div>
            <pre className="ui-code" style={{ whiteSpace: "pre-wrap" }}>{r.agentInstruction}</pre>
          </section>
        )}
      </Sheet>
    );
  }

  if (item.kind === "learned") {
    const c = item.change;
    return (
      <Sheet
        open
        onOpenChange={(v) => !v && onClose()}
        title="Learned decision"
        head={c.status === "approved" ? <Badge tone="blue">Settled decision</Badge> : <Badge tone="amber">Waiting for review</Badge>}
        footer={
          <>
            <Link className="ui-btn ui-btn--light ui-btn--wide" href={`/app/memory?d=${c.id}`}>
              Open in Memory
            </Link>
            <Link className="ui-btn" href={`/app/ask?q=${encodeURIComponent(`Why: ${c.decision}`)}`}>
              <ChatCircleIcon size={15} /> Ask
            </Link>
          </>
        }
      >
        <section className="ui-section">
          <div className="ui-label">The decision</div>
          <div className="ui-title ui-title--sm">{c.decision}</div>
          <div className="ui-small">Learned {feedTime(c.updatedAt)} · version {String((c as { version?: number }).version ?? 1)}</div>
        </section>
      </Sheet>
    );
  }

  const run = item.run;
  return (
    <Sheet
      open
      onOpenChange={(v) => !v && onClose()}
      title="Agent task"
      head={
        <>
          <Badge tone={run.status === "failed" ? "red" : run.status === "ready" ? "green" : "blue"} dot>
            {agentStatus(run)}
          </Badge>
          <strong style={{ color: "var(--ink)" }}>Agent task</strong>
        </>
      }
      footer={
        run.prUrl ? (
          <a className="ui-btn ui-btn--light ui-btn--wide" href={run.prUrl} target="_blank" rel="noreferrer">
            Open draft PR <ArrowSquareOutIcon size={15} />
          </a>
        ) : (
          <Link className="ui-btn ui-btn--wide" href="/app/tasks">
            Open agent tasks
          </Link>
        )
      }
    >
      <section className="ui-section">
        <div className="ui-label">What was asked</div>
        <p className="ui-body">{run.intent}</p>
      </section>
      {run.files.length > 0 && (
        <section className="ui-section">
          <div className="ui-label">Files</div>
          <ul style={{ display: "grid", gap: 6 }}>
            {run.files.map((f) => (
              <li key={f.path} className="ui-mono ui-small">
                {f.isNew ? "+ " : "~ "}
                {f.path}
              </li>
            ))}
          </ul>
        </section>
      )}
      {run.error && <ErrorState error={run.error} title="The task failed" />}
    </Sheet>
  );
}
