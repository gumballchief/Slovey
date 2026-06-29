"use client";

import { useEffect, useState } from "react";
import { useRepo } from "@/app/app/RepoProvider";
import { fetchArchitecture, rebuildMemory, type RepoKnowledge } from "@/lib/api-client";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Network, RefreshCw, Boxes, FileCode, Route, FlaskConical } from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function ArchitecturePage() {
  const { activeRepoId } = useRepo();
  const [data, setData] = useState<RepoKnowledge | null>(null);
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);

  async function load() {
    // setState only happens after the await, so this is safe to call from an effect.
    try {
      setData(await fetchArchitecture(activeRepoId));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRepoId]);

  async function reindex() {
    setReindexing(true);
    try {
      await rebuildMemory(activeRepoId);
    } catch {
      /* demo */
    }
    setTimeout(() => {
      setReindexing(false);
      load();
    }, 2000);
  }

  const arch = data?.architecture ?? null;
  const graph = data?.dependencyGraph ?? null;
  const langData = arch
    ? Object.entries(arch.languages)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }))
    : [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-[var(--cb-text)]">
            Repository Architecture
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            What Company Brain has learned about this repo&apos;s structure.
            {data?.generatedAt && (
              <span className="label-mono ml-2">
                indexed {new Date(data.generatedAt).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={reindex}
          disabled={reindexing}
          className="inline-flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border border-[var(--border)] hover:border-[var(--primary)] transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw size={13} className={reindexing ? "animate-spin" : ""} />
          {reindexing ? "Re-indexing…" : "Re-index"}
        </button>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm text-[var(--text-muted)]">Loading…</div>
      ) : !arch ? (
        <EmptyState
          icon={<Network size={22} />}
          title="Not indexed yet"
          description="Run a re-index to parse this repo's structure, frameworks, services, and dependency graph."
        />
      ) : (
        <>
          {/* Summary */}
          {arch.summary && (
            <div className="card p-5 border-l-2 border-[var(--primary)]">
              <p className="label-mono text-[var(--primary)] mb-1.5">Architecture summary</p>
              <p className="text-sm text-[var(--cb-text)] leading-relaxed">{arch.summary}</p>
            </div>
          )}

          {/* Stat row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Files", value: arch.fileCount, icon: <FileCode size={16} /> },
              { label: "Services", value: arch.services.length, icon: <Boxes size={16} /> },
              { label: "API routes", value: arch.apiRoutes.length, icon: <Route size={16} /> },
              { label: "Test files", value: arch.testStrategy.testFileCount, icon: <FlaskConical size={16} /> },
            ].map((s) => (
              <div key={s.label} className="card card-hover p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="label-mono text-[var(--text-muted)]">{s.label}</span>
                  <span className="w-8 h-8 rounded-lg bg-[var(--primary-soft)] flex items-center justify-center text-[var(--primary)]">
                    {s.icon}
                  </span>
                </div>
                <span className="font-mono text-3xl font-semibold text-[var(--cb-text)] tabular-nums">
                  {s.value}
                </span>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Languages */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-[var(--cb-text)] mb-4">Languages</h3>
              {langData.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">No recognized source files.</p>
              ) : (
                <div className="h-48" aria-label="Language breakdown">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={langData} layout="vertical" margin={{ left: 16, right: 8 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={80}
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
                        }}
                      />
                      <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Frameworks */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-[var(--cb-text)] mb-4">Frameworks &amp; tooling</h3>
              {arch.frameworks.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">None detected.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {arch.frameworks.map((f) => (
                    <Badge key={f} variant="primary">{f}</Badge>
                  ))}
                </div>
              )}
              {arch.testStrategy.runners.length > 0 && (
                <p className="text-xs text-[var(--text-muted)] mt-4">
                  Testing: {arch.testStrategy.runners.join(", ")}
                </p>
              )}
            </div>
          </div>

          {/* Services */}
          {arch.services.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-[var(--cb-text)] mb-4">Services &amp; modules</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {arch.services.map((s) => (
                  <div key={s.path} className="rounded-lg border border-[var(--border)] p-3">
                    <p className="text-sm font-medium text-[var(--cb-text)]">{s.name}</p>
                    <p className="font-mono text-xs text-[var(--text-muted)] mt-0.5">{s.path}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dependency graph */}
          {graph && (graph.nodes.length > 0 || graph.edges.length > 0) && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-[var(--cb-text)] mb-4">Dependencies</h3>
              <div className="flex flex-wrap gap-2">
                {graph.nodes.map((n) => (
                  <span
                    key={n.id}
                    className={`font-mono text-xs px-2 py-1 rounded ${
                      n.type === "internal"
                        ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                        : "bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border)]"
                    }`}
                  >
                    {n.id}
                  </span>
                ))}
              </div>
              {graph.edges.length > 0 && (
                <p className="text-xs text-[var(--text-muted)] mt-3">
                  {graph.edges.length} internal workspace link{graph.edges.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}

          {/* API routes */}
          {arch.apiRoutes.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-[var(--cb-text)] mb-4">API routes</h3>
              <ul className="space-y-1 max-h-64 overflow-y-auto">
                {arch.apiRoutes.map((r) => (
                  <li key={r} className="font-mono text-xs text-[var(--text-muted)]">{r}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
