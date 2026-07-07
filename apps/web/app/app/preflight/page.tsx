"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, MinusCircle, ShieldCheck, ShieldX, XCircle } from "lucide-react";
import { useRepo } from "@/app/app/RepoProvider";
import { fetchPreflight, type PreflightData } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ConnectRepoButton } from "@/components/ui/ConnectRepoButton";

export default function PreflightPage() {
  const { activeRepoId, activeRepo, loading: repoLoading } = useRepo();
  const [data, setData] = useState<PreflightData>({ runs: [], latest: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeRepoId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchPreflight(activeRepoId)
      .then((d) => !cancelled && setData(d))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeRepoId]);

  const latest = data.latest;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary-soft)]">
          <ShieldCheck size={16} className="text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="font-display text-lg font-semibold tracking-[-0.02em] text-[var(--cb-text)] leading-none">Preflight</h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            The gate agents run before committing — checks, decision-graph enforcement, and fix instructions.
          </p>
        </div>
      </div>

      {!repoLoading && activeRepo && activeRepoId && <CliTokenSection repoId={activeRepoId} />}

      {repoLoading || loading ? (
        <p className="mt-8 text-sm text-[var(--text-muted)]">Loading…</p>
      ) : !activeRepo ? (
        <EmptyState title="No repository connected" body="Connect a repo to see Preflight runs." cta />
      ) : !latest ? (
        <EmptyState
          title="No Preflight runs yet"
          body={`Run it from your machine: \`companybrain preflight\` in ${activeRepo.name}, or have your AI agent call the preflight_run MCP tool.`}
        />
      ) : (
        <>
          {/* safe-to-commit banner */}
          <div
            className={cn(
              "mt-6 flex items-center gap-3 rounded-xl border px-4 py-3",
              latest.run.safeToCommit
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-red-500/30 bg-red-500/5",
            )}
          >
            {latest.run.safeToCommit ? (
              <ShieldCheck size={20} className="text-emerald-500" />
            ) : (
              <ShieldX size={20} className="text-[#F43F5E]" />
            )}
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--cb-text)]">
                {latest.run.safeToCommit ? "Safe to commit" : "Do not commit yet"}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {latest.run.summary} · mode {latest.run.mode} · push {latest.run.safeToPush ? "ok" : "blocked"} · attempt{" "}
                {latest.run.attempt}/{latest.run.maxAttempts}
                {latest.run.branch ? ` · ${latest.run.branch}` : ""}
              </p>
            </div>
            {latest.run.humanReviewRequired && (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                human review required
              </span>
            )}
          </div>

          {/* agent instruction — what Preflight told the agent to do */}
          {latest.run.agentInstruction && (
            <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2.5 text-sm text-[var(--cb-text)]">
              {latest.run.agentInstruction}
            </p>
          )}

          {/* checks, grouped by supervisor agent in pipeline order */}
          <Section title="Agent pipeline">
            {groupByAgent(latest.checks, data.pipeline ?? []).map(([agent, checks]) => (
              <div key={agent} className="mb-3">
                <p className="label-mono mb-1 flex items-center gap-2 text-[var(--text-muted)]">
                  <span
                    className={cn(
                      "inline-block h-1.5 w-1.5 rounded-full",
                      checks.some((c) => c.status === "fail")
                        ? "bg-[#F43F5E]"
                        : checks.every((c) => c.status === "skipped")
                          ? "bg-[var(--text-muted)]"
                          : "bg-emerald-500",
                    )}
                  />
                  {agent} agent
                </p>
                <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
                  {checks.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                      <CheckIcon status={c.status} />
                      <span className="text-sm font-medium text-[var(--cb-text)]">{c.name}</span>
                      {c.blocking && (
                        <span className="rounded-full bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                          blocking
                        </span>
                      )}
                      <span className="label-mono text-[var(--text-muted)]">{c.command || "static"}</span>
                      <span className="ml-auto text-xs text-[var(--text-muted)]">{c.durationMs}ms</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {latest.checks.some((c) => c.status === "skipped") && (
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Skipped: {latest.checks.filter((c) => c.status === "skipped").map((c) => `${c.name} (${c.skippedReason})`).join("; ")}
              </p>
            )}
          </Section>

          {/* decision violations */}
          {latest.violations.length > 0 && (
            <Section title="Decision violations">
              {latest.violations.map((v) => (
                <div key={v.id} className="mb-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5">
                  <p className="text-sm font-semibold text-[#F43F5E] flex items-center gap-1.5">
                    <AlertTriangle size={13} /> {v.title}
                  </p>
                  <p className="mt-1 text-sm text-[var(--cb-text)]">{v.violation}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{v.instructionForAgent}</p>
                </div>
              ))}
            </Section>
          )}

          {/* fix instructions grouped by file (new runs) with legacy-error fallback */}
          {(latest.fixInstructions.length > 0 || latest.errors.length > 0) && (
            <Section title="Files with errors">
              {Object.entries(
                groupByFile(
                  latest.fixInstructions.length > 0
                    ? latest.fixInstructions.map((f) => ({ id: f.id, file: f.file, priority: f.priority, message: f.problem }))
                    : latest.errors.map((e) => ({ id: e.id, file: e.file, priority: e.priority, message: e.message })),
                ),
              ).map(([file, errs]) => (
                <div key={file} className="mb-3">
                  <p className="label-mono text-[var(--cb-text)]">{file || "(general)"}</p>
                  <ul className="mt-1 space-y-1">
                    {errs.map((e) => (
                      <li key={e.id} className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
                        <PriorityDot priority={e.priority} />
                        <span>{e.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Section>
          )}

          {/* recent runs */}
          <Section title="Recent runs">
            <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
              {data.runs.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  {r.status === "pass" ? (
                    <CheckCircle2 size={15} className="text-emerald-500" />
                  ) : (
                    <XCircle size={15} className="text-[#F43F5E]" />
                  )}
                  <span className="text-[var(--cb-text)]">{r.summary}</span>
                  <span className="ml-auto text-xs text-[var(--text-muted)]">
                    {r.branch ?? "—"} · #{r.attempt} · {new Date(r.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

/** Group checks by owning agent, ordered by the pipeline (unknown agents last). */
function groupByAgent<T extends { agent?: string }>(checks: T[], pipeline: string[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const c of checks) {
    const agent = c.agent ?? "other";
    if (!groups.has(agent)) groups.set(agent, []);
    groups.get(agent)!.push(c);
  }
  const order = (a: string) => {
    const i = pipeline.indexOf(a);
    return i === -1 ? pipeline.length : i;
  };
  return [...groups.entries()].sort((a, b) => order(a[0]) - order(b[0]));
}

function groupByFile<T extends { file: string }>(errors: T[]): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const e of errors) (out[e.file] ??= []).push(e);
  return out;
}

interface CliToken {
  id: string;
  name: string;
  tokenHint: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/** Self-serve CLI tokens: list, mint (plaintext shown once), revoke. */
function CliTokenSection({ repoId }: { repoId: string }) {
  const [tokens, setTokens] = useState<CliToken[]>([]);
  const [minted, setMinted] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () =>
    fetch(`/api/repos/${repoId}/tokens`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setTokens)
      .catch(() => {});

  useEffect(() => {
    setMinted(null);
    setError(null);
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId]);

  const mint = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/repos/${repoId}/tokens`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "cli" }),
      });
      const body = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !body.token) {
        setError(body.error ?? "Could not create a token.");
        return;
      }
      setMinted(body.token);
      setCopied(false);
      void refresh();
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (tokenId: string) => {
    await fetch(`/api/repos/${repoId}/tokens/${tokenId}`, { method: "DELETE" });
    void refresh();
  };

  const copy = async () => {
    if (!minted) return;
    await navigator.clipboard.writeText(minted);
    setCopied(true);
  };

  return (
    <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--cb-text)]">CLI access</p>
          <p className="text-xs text-[var(--text-muted)]">
            Mint a repo-scoped token, then set <code>COMPANY_BRAIN_TOKEN</code> for{" "}
            <code>companybrain preflight</code> / CI.
          </p>
        </div>
        <button
          onClick={mint}
          disabled={busy}
          className="shrink-0 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Generate token"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-[#F43F5E]">{error}</p>}

      {minted && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <code className="min-w-0 flex-1 truncate text-xs text-[var(--cb-text)]">{minted}</code>
          <button
            onClick={copy}
            className="shrink-0 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--cb-text)] hover:bg-[var(--bg-subtle)]"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <span className="shrink-0 text-[11px] text-[var(--text-muted)]">shown once</span>
        </div>
      )}

      {tokens.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center gap-3 text-xs">
              <code className="text-[var(--text-muted)]">{t.tokenHint}</code>
              <span className="text-[var(--text-muted)]">
                {t.name} · created {new Date(t.createdAt).toLocaleDateString()}
                {t.lastUsedAt ? ` · last used ${new Date(t.lastUsedAt).toLocaleDateString()}` : " · never used"}
              </span>
              <button
                onClick={() => revoke(t.id)}
                className="ml-auto shrink-0 text-[11px] text-[#F43F5E] hover:underline"
              >
                revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{title}</h2>
      {children}
    </div>
  );
}

function CheckIcon({ status }: { status: "pass" | "fail" | "skipped" | "error" }) {
  if (status === "pass") return <CheckCircle2 size={15} className="text-emerald-500" />;
  if (status === "fail" || status === "error") return <XCircle size={15} className="text-[#F43F5E]" />;
  return <MinusCircle size={15} className="text-[var(--text-muted)]" />;
}

function PriorityDot({ priority }: { priority: string | null }) {
  const color =
    priority === "critical" ? "bg-[#F43F5E]" : priority === "high" ? "bg-orange-500" : priority === "medium" ? "bg-amber-500" : "bg-[var(--text-muted)]";
  return <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", color)} />;
}

function EmptyState({ title, body, cta }: { title: string; body: string; cta?: boolean }) {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-[var(--border)] px-6 py-10 text-center">
      <p className="text-sm font-medium text-[var(--cb-text)]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-[var(--text-muted)]">{body}</p>
      {cta && <div className="mt-4 flex justify-center"><ConnectRepoButton /></div>}
    </div>
  );
}
