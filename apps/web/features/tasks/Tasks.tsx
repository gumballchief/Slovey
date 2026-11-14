"use client";

import { ArrowSquareOutIcon, LightbulbIcon, RobotIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createAgentTask, fetchAgentRuns, fetchTaskSuggestions, type AgentRunRow } from "@/lib/api-client";
import { NeedsRepo, Page } from "@/features/shell/Page";
import { useData } from "@/features/use-data";
import { Badge, Button, Empty, ErrorState, Ref, RowsSkeleton, Skeleton, errorMessage, timeAgo } from "@/ui/kit";

export function Tasks() {
  return (
    <Page
      eyebrow="Agent tasks"
      title={
        <>
          Hand it a task. <span className="dim">Get a draft PR.</span>
        </>
      }
      intro="Describe a change. Slovey's agent plans it within your decisions, writes it, runs Preflight on it, and opens a draft pull request that it has already reviewed against your memory."
      narrow
    >
      <NeedsRepo>{(repoId) => <TasksFor repoId={repoId} />}</NeedsRepo>
    </Page>
  );
}

const STATUS: Record<AgentRunRow["status"], { label: string; tone?: "blue" | "red" | "green" | "amber" }> = {
  queued: { label: "Queued", tone: "amber" },
  running: { label: "Working", tone: "blue" },
  ready: { label: "Draft PR ready", tone: "green" },
  failed: { label: "Failed", tone: "red" },
};

function TasksFor({ repoId }: { repoId: string }) {
  const runs = useData(repoId, () => fetchAgentRuns(repoId));
  const ideas = useData(`${repoId}|ideas`, () => fetchTaskSuggestions(repoId));
  const [intent, setIntent] = useState("");
  const [busy, setBusy] = useState(false);
  const active = (runs.data ?? []).some((r) => r.status === "queued" || r.status === "running");

  // While something is queued or running, refresh every 5 seconds.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(runs.reload, 5000);
    return () => clearInterval(t);
  }, [active, runs.reload]);

  async function start(text: string) {
    const v = text.trim();
    if (v.length < 8) return;
    setBusy(true);
    try {
      const run = await createAgentTask(repoId, v);
      runs.mutate((prev) => [run, ...(prev ?? [])]);
      setIntent("");
      toast.success("Started. You'll see the draft PR here when it's ready.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 36 }}>
      <form
        className="ui-card ui-card--raised"
        style={{ padding: 18, display: "grid", gap: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          void start(intent);
        }}
      >
        <label className="ui-field">
          <span>What should the agent change?</span>
          <textarea
            className="ui-textarea"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            maxLength={4000}
            placeholder="Move the retry cap for failed charges into config and document it"
          />
        </label>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="ui-small">It opens a draft PR. Nothing merges without you.</span>
          <Button type="submit" variant="light" loading={busy} disabled={intent.trim().length < 8} icon={<RobotIcon size={16} />}>
            Start task
          </Button>
        </div>
      </form>

      {(ideas.loading || (ideas.data && ideas.data.length > 0)) && (
        <section className="ui-section">
          <div className="ui-label">Suggested by your memory</div>
          {ideas.loading && <Skeleton h={64} r={14} />}
          {ideas.data?.map((s) => (
            <div key={s.intent} className="ui-card ui-card--pad" style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <div className="ui-h3">
                    <LightbulbIcon size={15} style={{ verticalAlign: -2, marginRight: 6, color: "var(--ice)" }} />
                    {s.intent}
                  </div>
                  <div className="ui-small">{s.reason}</div>
                </div>
                <Button size="sm" onClick={() => start(s.intent)} disabled={busy}>
                  Run it
                </Button>
              </div>
              {s.files.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {s.files.slice(0, 5).map((f) => (
                    <Ref key={f}>{f}</Ref>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="ui-section">
        <div className="ui-label">Runs</div>
        {runs.loading && <RowsSkeleton rows={3} />}
        {runs.error != null && <ErrorState error={runs.error} onRetry={runs.reload} title="Agent runs didn't load" />}
        {runs.data && runs.data.length === 0 && (
          <Empty icon={<RobotIcon size={22} />} title="No tasks yet">
            Start one above. A typical task takes two to five minutes.
          </Empty>
        )}
        {runs.data && runs.data.length > 0 && (
          <ul style={{ display: "grid", gap: 10 }}>
            {runs.data.map((r) => (
              <li key={r.id} className="ui-card ui-card--pad" style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div className="ui-h3" style={{ fontWeight: 600 }}>{r.intent}</div>
                  <Badge tone={STATUS[r.status].tone} dot>
                    {STATUS[r.status].label}
                  </Badge>
                </div>
                <div className="ui-row-sub">
                  {r.requestedBy && <>by {r.requestedBy} · </>}
                  {timeAgo(r.createdAt)}
                  {r.decisionsUsed > 0 && <> · used {r.decisionsUsed} decisions</>}
                  {r.reviseRounds > 0 && <> · revised {r.reviseRounds}×</>}
                  {r.ciState && <> · CI {r.ciState}</>}
                </div>
                {r.files.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {r.files.map((f) => (
                      <Ref key={f.path}>
                        {f.isNew ? "+ " : ""}
                        {f.path}
                      </Ref>
                    ))}
                  </div>
                )}
                {r.error && <ErrorState error={r.error} title="The task failed" />}
                {r.prUrl && (
                  <div>
                    <a className="ui-btn ui-btn--sm" href={r.prUrl} target="_blank" rel="noreferrer">
                      Open draft PR #{r.prNumber} <ArrowSquareOutIcon size={14} />
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
