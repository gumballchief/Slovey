"use client";

import { TreeStructureIcon } from "@phosphor-icons/react";
import { fetchArchitecture } from "@/lib/api-client";
import { NeedsRepo, Page } from "@/features/shell/Page";
import { useData } from "@/features/use-data";
import { Badge, Empty, ErrorState, Ref, Skeleton, Stat, timeAgo } from "@/ui/kit";

const LANG_COLORS = ["#3d7bff", "#a6d9ff", "#5a8fff", "#7f9cff", "#c9cddc", "#6c7290"];

export function Architecture() {
  return (
    <Page
      eyebrow="Architecture"
      title={
        <>
          How this repository <span className="dim">is built.</span>
        </>
      }
      intro="Slovey maps the codebase so its checks and its agent know where things live: languages, frameworks, services, routes and how it's tested."
    >
      <NeedsRepo>{(repoId) => <ArchFor repoId={repoId} />}</NeedsRepo>
    </Page>
  );
}

function ArchFor({ repoId }: { repoId: string }) {
  const k = useData(repoId, () => fetchArchitecture(repoId));
  if (k.loading) return <Skeleton h={300} r={14} />;
  if (k.error != null) return <ErrorState error={k.error} onRetry={k.reload} title="Architecture didn't load" />;
  const a = k.data?.architecture;
  if (!a) {
    return (
      <Empty icon={<TreeStructureIcon size={22} />} title="Not mapped yet">
        Slovey maps a repository right after it connects and again after big changes. Check back in a few minutes.
      </Empty>
    );
  }
  const langs = Object.entries(a.languages).sort((x, y) => y[1] - x[1]);
  const total = langs.reduce((s, [, n]) => s + n, 0) || 1;
  const deps = k.data?.dependencyGraph;

  return (
    <div style={{ display: "grid", gap: 36 }}>
      {a.summary && <p className="ui-body" style={{ fontSize: 17, maxWidth: 760, color: "var(--ink)" }}>{a.summary}</p>}
      <div className="ui-stats">
        <Stat n={a.fileCount.toLocaleString()} label="files" />
        <Stat n={a.services.length} label="services" />
        <Stat n={a.apiRoutes.length} label="API routes" />
        <Stat n={a.testStrategy.testFileCount} label="test files" />
      </div>

      {langs.length > 0 && (
        <section className="ui-section">
          <div className="ui-label">Languages</div>
          <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", background: "var(--panel)" }}>
            {langs.map(([l, n], i) => (
              <div key={l} title={`${l} ${Math.round((n / total) * 100)}%`} style={{ width: `${(n / total) * 100}%`, background: LANG_COLORS[i % LANG_COLORS.length] }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            {langs.slice(0, 8).map(([l, n], i) => (
              <span key={l} className="ui-small" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: LANG_COLORS[i % LANG_COLORS.length] }} />
                <span style={{ color: "var(--ink)" }}>{l}</span> {Math.round((n / total) * 100)}%
              </span>
            ))}
          </div>
        </section>
      )}

      {a.frameworks.length > 0 && (
        <section className="ui-section">
          <div className="ui-label">Frameworks</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {a.frameworks.map((f) => (
              <Badge key={f} tone="blue">{f}</Badge>
            ))}
          </div>
        </section>
      )}

      {a.services.length > 0 && (
        <section className="ui-section">
          <div className="ui-label">Services</div>
          <div className="ui-card ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th style={{ paddingTop: 14 }}>Name</th>
                  <th style={{ paddingTop: 14 }}>Path</th>
                  <th style={{ paddingTop: 14 }}>Kind</th>
                </tr>
              </thead>
              <tbody>
                {a.services.map((s) => (
                  <tr key={s.path}>
                    <td style={{ color: "var(--ink)", fontWeight: 600 }}>{s.name}</td>
                    <td><Ref>{s.path}</Ref></td>
                    <td className="ui-muted">{s.kind}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="ui-section-grid">
        <section className="ui-section">
          <div className="ui-label">Testing</div>
          <div className="ui-card ui-card--pad" style={{ display: "grid", gap: 8 }}>
            <div className="ui-h3">{a.testStrategy.hasTests ? `${a.testStrategy.testFileCount} test files` : "No tests found"}</div>
            <div className="ui-small">
              {a.testStrategy.runners.length > 0
                ? `Runs with ${a.testStrategy.runners.join(", ")}`
                : "Slovey found no test runner in this repository."}
            </div>
          </div>
        </section>
        <section className="ui-section">
          <div className="ui-label">Top-level folders</div>
          <div className="ui-card ui-card--pad" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {a.topLevelDirs.length > 0 ? (
              a.topLevelDirs.map((d) => <Ref key={d}>{d}/</Ref>)
            ) : (
              <span className="ui-small">Every file sits at the root.</span>
            )}
          </div>
        </section>
        {deps && (
          <section className="ui-section">
            <div className="ui-label">Dependencies</div>
            <div className="ui-card ui-card--pad" style={{ display: "grid", gap: 8 }}>
              <div className="ui-h3">{deps.nodes.filter((n) => n.type === "external").length} external packages</div>
              <div className="ui-small">
                {deps.nodes.filter((n) => n.type === "internal").length} internal modules, {deps.edges.length} import links
              </div>
            </div>
          </section>
        )}
      </div>

      {a.apiRoutes.length > 0 && (
        <section className="ui-section">
          <div className="ui-label">API routes</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {a.apiRoutes.slice(0, 80).map((r) => (
              <Ref key={r}>{r}</Ref>
            ))}
            {a.apiRoutes.length > 80 && <span className="ui-small">+{a.apiRoutes.length - 80} more</span>}
          </div>
        </section>
      )}
      {k.data?.generatedAt && <div className="ui-small">Mapped {timeAgo(k.data.generatedAt)}</div>}
    </div>
  );
}
