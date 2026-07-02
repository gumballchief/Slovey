"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  Bot,
  ExternalLink,
  FileCode2,
  Loader2,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { useRepo } from "@/app/app/RepoProvider";
import {
  createAgentTask,
  fetchAgentRuns,
  fetchTaskSuggestions,
  type AgentRunRow,
  type SuggestedTaskRow,
} from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ConnectRepoButton } from "@/components/ui/ConnectRepoButton";

const EXAMPLES = [
  "Add a GET /api/ping route that returns { ok: true }",
  "Add input validation to the signup endpoint",
  "Add a health-check script under scripts/",
];

export default function TasksPage() {
  const { activeRepoId, activeRepo, loading: repoLoading } = useRepo();
  const [runs, setRuns] = useState<AgentRunRow[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [intent, setIntent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!activeRepoId) return;
    const rows = await fetchAgentRuns(activeRepoId);
    setRuns(rows);
    return rows;
  }, [activeRepoId]);

  // Initial load per repo.
  useEffect(() => {
    if (!activeRepoId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchAgentRuns(activeRepoId)
      .then((rows) => !cancelled && setRuns(rows))
      .finally(() => !cancelled && setLoading(false));
    // Proactive suggestions load in the background — slower (walks the repo).
    setSuggestions([]);
    fetchTaskSuggestions(activeRepoId).then((s) => !cancelled && setSuggestions(s));
    return () => {
      cancelled = true;
    };
  }, [activeRepoId]);

  // Poll while anything is in flight.
  const active = runs.some((r) => r.status === "queued" || r.status === "running");
  useEffect(() => {
    if (!active) return;
    timer.current = setInterval(refresh, 4000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [active, refresh]);

  async function submit(text: string) {
    const value = text.trim();
    if (!value || !activeRepoId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await createAgentTask(activeRepoId, value);
      setIntent("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary-soft)]">
          <Bot size={16} className="text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="font-display text-lg font-semibold tracking-[-0.02em] text-[var(--cb-text)] leading-none">
            Agent
          </h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Describe a change — the agent writes it constrained by your team&rsquo;s decisions, opens a draft PR, and
            reviews its own work.
          </p>
        </div>
      </div>

      {repoLoading || loading ? (
        <p className="mt-8 text-sm text-[var(--text-muted)]">Loading…</p>
      ) : !activeRepo ? (
        <div className="mt-8 rounded-xl border border-dashed border-[var(--border)] px-6 py-10 text-center">
          <p className="text-sm font-medium text-[var(--cb-text)]">No repository connected</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Connect a repo to give the agent something to work on.</p>
          <div className="mt-4 flex justify-center"><ConnectRepoButton /></div>
        </div>
      ) : (
        <>
          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(intent);
            }}
            className="mt-6 flex items-end gap-2"
          >
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(intent);
                }
              }}
              rows={2}
              maxLength={500}
              placeholder={`What should the agent build in ${activeRepo.name}?`}
              className="max-h-40 flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--cb-text)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!intent.trim() || submitting}
              aria-label="Start agent task"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} />}
            </button>
          </form>
          {error && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-[#F43F5E]">
              <AlertTriangle size={13} /> {error}
            </p>
          )}
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            The agent opens a <strong className="text-[var(--cb-text)]">draft PR</strong> — nothing merges without you.
          </p>

          {/* Proactive: rejected patterns still in the code → one-click cleanup tasks */}
          {suggestions.length > 0 && (
            <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                Suggested by memory — rejected patterns still in the code
              </p>
              <div className="mt-2 space-y-2">
                {suggestions.map((s) => (
                  <div key={s.intent} className="flex items-start justify-between gap-3">
                    <p className="text-sm leading-snug text-[var(--cb-text)]">{s.intent}</p>
                    <button
                      onClick={() => submit(s.intent)}
                      disabled={submitting}
                      className="shrink-0 cursor-pointer rounded-lg bg-[var(--primary)] px-3 py-1 text-xs font-medium text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-40"
                    >
                      Run
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Runs */}
          {runs.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-[var(--border)] px-6 py-10 text-center">
              <p className="text-sm font-medium text-[var(--cb-text)]">No tasks yet</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-[var(--text-muted)]">Try one of these to see the loop:</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setIntent(ex)}
                    className="cursor-pointer rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs text-[var(--cb-text)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {runs.map((run) => (
                <RunCard key={run.id} run={run} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const STATUS_STYLE: Record<AgentRunRow["status"], string> = {
  queued: "bg-[var(--bg-subtle)] text-[var(--text-muted)]",
  running: "bg-[var(--primary-soft)] text-[var(--primary-strong)]",
  ready: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  failed: "bg-red-500/10 text-[#F43F5E]",
};

function RunCard({ run }: { run: AgentRunRow }) {
  const inFlight = run.status === "queued" || run.status === "running";
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-snug text-[var(--cb-text)]">{run.intent}</p>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
            STATUS_STYLE[run.status],
          )}
        >
          {inFlight && <Loader2 size={11} className="animate-spin" />}
          {run.status}
        </span>
      </div>

      {run.status === "ready" && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--text-muted)]">
          {run.prUrl && (
            <a
              href={run.prUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-[var(--primary)] hover:underline"
            >
              <ExternalLink size={11} />
              {run.draft ? "Draft PR" : "PR"} #{run.prNumber}
            </a>
          )}
          {(run.files?.length ? run.files : run.filePath ? [{ path: run.filePath, isNew: !!run.isNewFile }] : []).map((f) => (
            <span key={f.path} className="inline-flex items-center gap-1">
              <FileCode2 size={11} />
              {f.path}
              {f.isNew ? " (new)" : ""}
            </span>
          ))}
          <span>{run.decisionsUsed} decision{run.decisionsUsed === 1 ? "" : "s"} honored</span>
          {run.verdict && <VerdictChip verdict={run.verdict} />}
          {run.reviseRounds > 0 && (
            <span className="rounded-full bg-[var(--primary-soft)] px-2 py-0.5 font-medium text-[var(--primary-strong)]">
              self-revised ×{run.reviseRounds}
            </span>
          )}
          {run.ciState && run.ciState !== "unknown" && <span>{run.ciSummary}</span>}
        </div>
      )}

      {run.status === "failed" && run.error && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-[#F43F5E]">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          {run.error}
        </p>
      )}

      <p className="mt-2 text-[11px] text-[var(--text-muted)]/70">
        {run.requestedBy ? `${run.requestedBy} · ` : ""}
        {new Date(run.createdAt).toLocaleString()}
      </p>
    </div>
  );
}

function VerdictChip({ verdict }: { verdict: string }) {
  const clear = verdict === "clear";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
        clear ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      )}
    >
      {clear ? <ShieldCheck size={11} /> : <ShieldX size={11} />}
      self-review: {verdict}
    </span>
  );
}

