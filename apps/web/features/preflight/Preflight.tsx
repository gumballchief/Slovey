"use client";

import "./preflight.css";
import {
  CheckCircleIcon,
  CircleDashedIcon,
  ListChecksIcon,
  PlayIcon,
  TerminalWindowIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  fetchPreflight,
  type PreflightCheckRow,
  type PreflightErrorRow,
  type PreflightFixRow,
  type PreflightRunRow,
  type PreflightViolationRow,
} from "@/lib/api-client";
import { NeedsRepo, Page } from "@/features/shell/Page";
import { useData } from "@/features/use-data";
import { Badge, Button, Empty, ErrorState, Modal, Ref, RowsSkeleton, Skeleton, errorMessage, feedTime } from "@/ui/kit";

type Detail = {
  run: PreflightRunRow;
  checks: PreflightCheckRow[];
  errors: PreflightErrorRow[];
  fixInstructions: PreflightFixRow[];
  violations: PreflightViolationRow[];
};

async function getRun(repoId: string, runId: string): Promise<Detail> {
  const res = await fetch(`/api/repos/${repoId}/preflight/runs/${runId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`.trim());
  return (await res.json()) as Detail;
}

export function Preflight() {
  const [checking, setChecking] = useState(false);
  return (
    <Page
      eyebrow="Preflight"
      title={
        <>
          The gate before <span className="dim">every commit.</span>
        </>
      }
      intro="Coding agents run Preflight before they commit: your build and tests locally, plus a check of the change against every decision Slovey learned. A failed run tells the agent exactly what to fix."
      actions={
        <>
          <Link className="ui-btn" href="/app/settings#cli">
            <TerminalWindowIcon size={16} /> Set up the CLI
          </Link>
          <Button variant="light" icon={<PlayIcon size={15} weight="fill" />} onClick={() => setChecking(true)}>
            Check a change
          </Button>
        </>
      }
    >
      <NeedsRepo>{(repoId) => <PreflightFor repoId={repoId} checking={checking} setChecking={setChecking} />}</NeedsRepo>
    </Page>
  );
}

function PreflightFor({
  repoId,
  checking,
  setChecking,
}: {
  repoId: string;
  checking: boolean;
  setChecking: (v: boolean) => void;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const data = useData(repoId, () => fetchPreflight(repoId));
  const runs = data.data?.runs ?? [];
  const wanted = params.get("run");
  const selectedId = wanted && runs.some((r) => r.id === wanted) ? wanted : (runs[0]?.id ?? null);
  const detail = useData(selectedId ? `${repoId}|${selectedId}` : null, async () => {
    const latest = data.data?.latest;
    if (latest && latest.run.id === selectedId) return latest as Detail;
    return getRun(repoId, selectedId!);
  });

  return (
    <>
      {data.loading && <RowsSkeleton rows={5} />}
      {data.error != null && <ErrorState error={data.error} onRetry={data.reload} title="Preflight runs didn't load" />}
      {data.data && runs.length === 0 && (
        <Empty
          icon={<ListChecksIcon size={22} />}
          title="No Preflight runs yet"
          action={
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <Link className="ui-btn ui-btn--light" href="/app/settings#cli">
                Set up the CLI
              </Link>
              <Button onClick={() => setChecking(true)}>Try it on a diff</Button>
            </div>
          }
        >
          Install the Slovey CLI or MCP server and your coding agent runs Preflight before every commit. Runs show up
          here.
        </Empty>
      )}
      {runs.length > 0 && (
        <div className="pf">
          <ol className="pf-runs" aria-label="Runs">
            {runs.map((r) => {
              const ok = r.safeToCommit && r.status !== "fail";
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className="pf-run"
                    data-on={r.id === selectedId}
                    onClick={() => router.replace(`/app/preflight?run=${r.id}`, { scroll: false })}
                  >
                    <StatusIcon status={r.status} ok={ok} />
                    <span className="pf-run-t">
                      <strong>{ok ? "Passed" : r.status === "unverified" ? "Unverified" : "Stopped"}</strong>
                      <span className="ui-mono">{r.branch ?? "local"}</span>
                      {r.commitSha && <span className="ui-mono">{r.commitSha.slice(0, 7)}</span>}
                    </span>
                    <span className="ui-row-time">{feedTime(r.createdAt)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="pf-detail">
            {detail.loading && <Skeleton h={320} r={14} />}
            {detail.error != null && <ErrorState error={detail.error} onRetry={detail.reload} title="This run didn't load" />}
            {detail.data && <RunDetail d={detail.data} pipeline={data.data?.pipeline} />}
          </div>
        </div>
      )}
      <CheckChange open={checking} onOpenChange={setChecking} repoId={repoId} onDone={data.reload} />
    </>
  );
}

function StatusIcon({ status, ok }: { status: PreflightRunRow["status"] | PreflightCheckRow["status"]; ok?: boolean }) {
  if (status === "skipped") return <CircleDashedIcon size={18} className="pf-i pf-i--skip" />;
  if (status === "error" || status === "unverified") return <WarningCircleIcon size={18} className="pf-i pf-i--warn" weight="fill" />;
  if (ok ?? status === "pass") return <CheckCircleIcon size={18} className="pf-i pf-i--ok" weight="fill" />;
  return <XCircleIcon size={18} className="pf-i pf-i--bad" weight="fill" />;
}

const AGENT_LABEL: Record<string, string> = {
  build: "Build",
  security: "Security",
  decision: "Decisions",
  architecture: "Architecture",
  performance: "Performance",
  testing: "Tests",
  context: "Context",
};

function RunDetail({ d, pipeline }: { d: Detail; pipeline?: string[] }) {
  const r = d.run;
  const ok = r.safeToCommit && r.status !== "fail";
  const groups = new Map<string, PreflightCheckRow[]>();
  for (const c of d.checks) {
    const k = c.agent ?? "other";
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  const order = [...(pipeline ?? []), ...[...groups.keys()].filter((k) => !(pipeline ?? []).includes(k))].filter((k) => groups.has(k));

  return (
    <div className="pf-body">
      <div className="pf-verdict" data-ok={ok}>
        <div>
          <div className="ui-label">{ok ? "Safe to commit" : r.status === "unverified" ? "Couldn't verify" : "Do not commit"}</div>
          <p className="ui-body" style={{ marginTop: 6 }}>{r.summary}</p>
        </div>
        <div className="pf-verdict-meta ui-small">
          attempt {r.attempt} of {r.maxAttempts} · {(r.durationMs / 1000).toFixed(1)}s
          {r.humanReviewRequired && <Badge tone="amber">needs a human</Badge>}
        </div>
      </div>

      {d.violations.length > 0 && (
        <section className="ui-section">
          <div className="ui-label">Decisions this change breaks</div>
          {d.violations.map((v) => (
            <div key={v.id} className="pf-violation">
              <div className="ui-h3">{v.title}</div>
              <p className="ui-body">{v.violation}</p>
              <div className="ui-small">{Math.round(v.confidence * 100)}% confident</div>
            </div>
          ))}
        </section>
      )}

      <section className="ui-section">
        <div className="ui-label">Checks</div>
        <div className="pf-agents">
          {order.map((k) => (
            <div key={k} className="pf-agent">
              <div className="pf-agent-h">{AGENT_LABEL[k] ?? k}</div>
              {groups.get(k)!.map((c) => (
                <div key={c.id} className="pf-check">
                  <StatusIcon status={c.status} />
                  <span className="name">{c.name}</span>
                  {c.blocking && <span className="ui-small">required</span>}
                  <span className="dur ui-mono">{c.status === "skipped" ? "skipped" : `${(c.durationMs / 1000).toFixed(1)}s`}</span>
                  {c.skippedReason && <span className="why">{c.skippedReason}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {d.fixInstructions.length > 0 && (
        <section className="ui-section">
          <div className="ui-label">What the agent was told to fix</div>
          {d.fixInstructions.map((f) => (
            <div key={f.id} className="pf-fix">
              <div className="pf-fix-h">
                <Badge tone={f.priority === "high" || f.priority === "critical" ? "red" : f.priority === "low" ? undefined : "amber"}>
                  {f.priority}
                </Badge>
                {f.file && <Ref>{f.file}</Ref>}
              </div>
              <div className="ui-body">{f.problem}</div>
              <pre className="ui-code" style={{ whiteSpace: "pre-wrap" }}>{f.instructionForAgent}</pre>
            </div>
          ))}
        </section>
      )}

      {d.errors.length > 0 && d.fixInstructions.length === 0 && (
        <section className="ui-section">
          <div className="ui-label">Errors</div>
          <ul className="pf-errors">
            {d.errors.slice(0, 30).map((e) => (
              <li key={e.id}>
                <span className="ui-mono">
                  {e.file}
                  {e.line ? `:${e.line}` : ""}
                </span>
                <span>{e.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.agentInstruction && (
        <section className="ui-section">
          <div className="ui-label">Instruction to the agent</div>
          <pre className="ui-code" style={{ whiteSpace: "pre-wrap" }}>{r.agentInstruction}</pre>
        </section>
      )}
    </div>
  );
}

type RemoteResult = {
  status: string;
  safeToCommit: boolean;
  summary: string;
  decisionViolations?: Array<{ title: string; violation: string; confidence: number }>;
  warnings?: string[];
};

function CheckChange({
  open,
  onOpenChange,
  repoId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  repoId: string;
  onDone: () => void;
}) {
  const [diff, setDiff] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RemoteResult | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const changedFiles = [...diff.matchAll(/^\+\+\+ b\/(.+)$/gm)].map((m) => m[1]!.trim());
      const res = await fetch(`/api/repos/${repoId}/preflight/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ diff, changedFiles }),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`.trim());
      setResult((await res.json()) as RemoteResult);
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setResult(null);
      }}
      title="Check a change"
      description="Paste a git diff. Slovey checks it against your decisions and architecture rules, the same way it does for an agent. Build and tests only run on your machine, so they're skipped here."
      actions={
        <>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
          <Button variant="light" loading={busy} disabled={diff.trim().length < 10} onClick={run} icon={<PlayIcon size={14} weight="fill" />}>
            Run the check
          </Button>
        </>
      }
    >
      <textarea
        className="ui-textarea"
        style={{ minHeight: 200, fontFamily: "var(--mono)", fontSize: 12.5 }}
        value={diff}
        onChange={(e) => setDiff(e.target.value)}
        placeholder={"diff --git a/src/charges/retry.ts b/src/charges/retry.ts\n--- a/src/charges/retry.ts\n+++ b/src/charges/retry.ts\n-  maxRetries: 3,\n+  maxRetries: 8,"}
        spellCheck={false}
      />
      {result && (
        <div className="pf-verdict" data-ok={result.safeToCommit}>
          <div>
            <div className="ui-label">{result.safeToCommit ? "Safe to commit" : "Do not commit"}</div>
            <p className="ui-body" style={{ marginTop: 6 }}>{result.summary}</p>
            {result.decisionViolations?.map((v, i) => (
              <div key={i} className="pf-violation" style={{ marginTop: 10 }}>
                <div className="ui-h3">{v.title}</div>
                <p className="ui-body">{v.violation}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

