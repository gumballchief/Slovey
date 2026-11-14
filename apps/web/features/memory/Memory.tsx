"use client";

import "./memory.css";
import {
  ArrowsInIcon,
  ChatCircleIcon,
  CheckIcon,
  FileArrowUpIcon,
  GraphIcon,
  ListBulletsIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  PencilSimpleIcon,
  PlusIcon,
  SealCheckIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createDecision,
  deleteDecision,
  fetchDecisions,
  importDocs,
  reviewDecision,
  searchDecisions,
  updateDecision,
} from "@/lib/api-client";
import type { Decision } from "@/lib/data";
import { EvidenceList, SOURCE_LABEL } from "@/features/refs";
import { NeedsRepo } from "@/features/shell/Page";
import { useRepo } from "@/features/shell/RepoProvider";
import { useData } from "@/features/use-data";
import {
  Badge,
  Button,
  Chip,
  Empty,
  ErrorState,
  IconButton,
  Modal,
  RowsSkeleton,
  Segmented,
  Sheet,
  Tip,
  errorMessage,
  timeAgo,
} from "@/ui/kit";
import { buildGraph, type GNode, type NodeKind } from "./graph";

type View = "map" | "list";

export function Memory() {
  return <NeedsRepo>{(repoId) => <MemoryFor repoId={repoId} />}</NeedsRepo>;
}

function MemoryFor({ repoId }: { repoId: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const { repo, refreshReviewCount } = useRepo();
  const [view, setView] = useState<View>("map");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [kinds, setKinds] = useState<Record<NodeKind, boolean>>({ decision: true, pr: true, incident: true, doc: true });
  const [selected, setSelected] = useState<string | null>(params.get("d"));
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);

  // A map of dozens of nodes is unreadable on a phone: open as a list there.
  useEffect(() => {
    if (window.matchMedia("(max-width: 860px)").matches) setView("list");
  }, []);

  const all = useData(repoId, () => fetchDecisions(repoId));
  const hits = useData(query.trim() ? `${repoId}|${query.trim()}` : null, () => searchDecisions(repoId, query.trim()));

  // Debounce typing into the actual search.
  useEffect(() => {
    const t = setTimeout(() => setQuery(q), 280);
    return () => clearTimeout(t);
  }, [q]);

  const decisions = all.data ?? [];
  const hitIds = useMemo(() => (query.trim() && hits.data ? new Set(hits.data.map((d) => d.id)) : null), [query, hits.data]);
  const graph = useMemo(() => buildGraph(decisions), [decisions]);
  const byId = useMemo(() => new Map(decisions.map((d) => [d.id, d])), [decisions]);
  const selectedDecision = selected ? (byId.get(selected) ?? null) : null;
  const open = openId ? (byId.get(openId) ?? null) : null;

  function refresh() {
    all.reload();
    refreshReviewCount();
  }

  return (
    <main className="mem">
      <div className="mem-top">
        <label className="ui-search mem-search">
          <MagnifyingGlassIcon size={17} />
          <span className="ui-sr">Search memory</span>
          <input
            className="ui-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search decisions, pull requests, incidents"
          />
          {query.trim() && <span className="trail">{hits.loading ? "…" : `${hits.data?.length ?? 0} results`}</span>}
        </label>
        <div className="mem-filters">
          {view === "map" &&
            (
              [
                ["decision", "Decisions"],
                ["pr", "Pull requests"],
                ["incident", "Incidents"],
                ["doc", "Docs"],
              ] as Array<[NodeKind, string]>
            ).map(([k, label]) => (
              <Chip key={k} on={kinds[k]} onClick={() => setKinds((s) => ({ ...s, [k]: !s[k] }))}>
                {label}
              </Chip>
            ))}
          <span className="mem-spacer" />
          <Segmented<View>
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "map", label: "Map" },
              { value: "list", label: "List" },
            ]}
          />
          <Button size="sm" icon={<FileArrowUpIcon size={15} />} onClick={() => setImporting(true)}>
            Import docs
          </Button>
          <Button size="sm" variant="light" icon={<PlusIcon size={15} />} onClick={() => setAdding(true)}>
            Add decision
          </Button>
        </div>
      </div>

      {all.loading && (
        <div className="mem-pad">
          <RowsSkeleton rows={6} />
        </div>
      )}
      {all.error != null && (
        <div className="mem-pad">
          <ErrorState error={all.error} onRetry={all.reload} title="Memory didn't load" />
        </div>
      )}
      {all.data && decisions.length === 0 && (
        <div className="mem-pad">
          <Empty
            icon={<GraphIcon size={22} />}
            title="No decisions yet"
            action={
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                <Button variant="light" onClick={() => setImporting(true)} icon={<FileArrowUpIcon size={15} />}>
                  Import ADRs or docs
                </Button>
                <Button onClick={() => setAdding(true)} icon={<PlusIcon size={15} />}>
                  Add one by hand
                </Button>
              </div>
            }
          >
            Slovey learns decisions from your merged and rejected pull requests. While the first scan runs you can
            paste in existing ADRs or add the rules you already know.
          </Empty>
        </div>
      )}

      {all.data && decisions.length > 0 && view === "map" && (
        <MemoryMap
          nodes={graph.nodes}
          edges={graph.edges}
          kinds={kinds}
          hitIds={hitIds}
          selected={selected}
          onSelect={setSelected}
        />
      )}
      {all.data && decisions.length > 0 && view === "list" && (
        <div className="mem-pad">
          <MemoryList
            decisions={hitIds ? decisions.filter((d) => hitIds.has(d.id)) : decisions}
            searching={Boolean(query.trim())}
            repoName={repo?.name}
            onOpen={setOpenId}
          />
        </div>
      )}

      {view === "map" && selectedDecision && (
        <aside className="mem-card ui-card ui-card--raised" aria-label="Selected decision">
          <div className="mem-card-head">
            {selectedDecision.status === "suggested" ? (
              <Badge tone="amber">Waiting for review</Badge>
            ) : (
              <Badge tone="blue">
                <SealCheckIcon size={13} weight="fill" /> Settled decision
              </Badge>
            )}
            <IconButton label="Close" small onClick={() => setSelected(null)}>
              <XIcon size={14} />
            </IconButton>
          </div>
          <h2 className="ui-title ui-title--sm">{selectedDecision.decision}</h2>
          {selectedDecision.why && <p className="ui-body mem-card-why">{selectedDecision.why}</p>}
          <div className="ui-stats" style={{ gap: 32 }}>
            <div className="ui-stat">
              <div className="n" style={{ fontSize: 32 }}>{selectedDecision.evidence?.length ?? 0}</div>
              <div className="l">sources</div>
            </div>
            <div className="ui-stat">
              <div className="n" style={{ fontSize: 32 }}>{selectedDecision.examples?.length ?? 0}</div>
              <div className="l">examples</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="light" wide onClick={() => setOpenId(selectedDecision.id)}>
              Open decision
            </Button>
            <Link className="ui-btn" href={`/app/ask?q=${encodeURIComponent(`Why do we have this rule: ${selectedDecision.decision}`)}`}>
              Ask about it
            </Link>
          </div>
        </aside>
      )}

      <DecisionSheet
        decision={open}
        repoId={repoId}
        repoName={repo?.name}
        onClose={() => setOpenId(null)}
        onChanged={refresh}
        onDeleted={() => {
          setOpenId(null);
          setSelected(null);
          refresh();
          router.replace("/app/memory");
        }}
      />
      <AddDecision open={adding} onOpenChange={setAdding} repoId={repoId} onAdded={refresh} />
      <ImportDocs open={importing} onOpenChange={setImporting} repoId={repoId} onDone={refresh} />
    </main>
  );
}

/* ───────────── map ───────────── */

function MemoryMap({
  nodes,
  edges,
  kinds,
  hitIds,
  selected,
  onSelect,
}: {
  nodes: GNode[];
  edges: Array<{ from: string; to: string; red: boolean }>;
  kinds: Record<NodeKind, boolean>;
  hitIds: Set<string> | null;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 0.62 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);

  const visible = useMemo(() => new Set(nodes.filter((n) => kinds[n.kind]).map((n) => n.id)), [nodes, kinds]);
  const pos = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  // Linked to the selection: highlighted; everything else dims a little.
  const linked = useMemo(() => {
    if (!selected) return null;
    const s = new Set([selected]);
    for (const e of edges) {
      if (e.from === selected) s.add(e.to);
      if (e.to === selected) s.add(e.from);
    }
    return s;
  }, [selected, edges]);

  function zoom(f: number) {
    setView((v) => ({ ...v, k: Math.min(2.2, Math.max(0.3, v.k * f)) }));
  }

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      setView((v) => ({ ...v, k: Math.min(2.2, Math.max(0.3, v.k * (e.deltaY > 0 ? 0.9 : 1.1))) }));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={wrap}
      className="mem-map"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        // Only a real drag pans (and captures the pointer); a plain click still reaches the card.
        if (!d.moved && Math.abs(dx) + Math.abs(dy) > 4) {
          d.moved = true;
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        }
        if (d.moved) setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
      }}
      onPointerUp={() => {
        const d = drag.current;
        // Leave `moved` readable for the click handler below, then clear.
        setTimeout(() => {
          if (drag.current === d) drag.current = null;
        }, 0);
      }}
      onClick={(e) => {
        const d = drag.current;
        if (d?.moved) return;
        if (!(e.target as HTMLElement).closest(".mem-node")) onSelect(null);
      }}
    >
      <div className="mem-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        <svg className="mem-edges" aria-hidden>
          {edges.map((e, i) => {
            if (!visible.has(e.from) || !visible.has(e.to)) return null;
            const a = pos.get(e.from)!;
            const b = pos.get(e.to)!;
            const on = linked ? linked.has(e.from) && linked.has(e.to) : false;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                data-red={e.red}
                data-on={on}
                data-dim={linked != null && !on}
              />
            );
          })}
        </svg>
        {nodes.map((n) => {
          if (!visible.has(n.id)) return null;
          const dim = (linked && !linked.has(n.id)) || (hitIds && n.kind === "decision" && !hitIds.has(n.id));
          return (
            <button
              key={n.id}
              type="button"
              className="mem-node"
              data-kind={n.kind}
              data-on={selected === n.id}
              data-dim={Boolean(dim)}
              style={{ left: n.x, top: n.y }}
              onClick={() => onSelect(n.kind === "decision" ? n.id : selected === n.id ? null : n.id)}
              aria-label={`${n.sub}: ${n.label}`}
            >
              {n.kind === "decision" ? (
                <>
                  <span className="t">{clip(n.label, 58)}</span>
                  <span className="s">
                    {n.sub} · {n.degree} {n.degree === 1 ? "link" : "links"}
                  </span>
                </>
              ) : (
                <span className="tag">
                  {n.label}
                  <em>{n.sub}</em>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mem-legend" aria-hidden>
        <span><i data-k="decision" /> Decision</span>
        <span><i data-k="pr" /> Pull request</span>
        <span><i data-k="incident" /> Incident</span>
        <span><i data-k="doc" /> Doc</span>
      </div>
      <div className="mem-zoom">
        <Tip label="Zoom in">
          <IconButton label="Zoom in" onClick={() => zoom(1.2)}>
            <PlusIcon size={16} />
          </IconButton>
        </Tip>
        <Tip label="Zoom out">
          <IconButton label="Zoom out" onClick={() => zoom(1 / 1.2)}>
            <MinusIcon size={16} />
          </IconButton>
        </Tip>
        <Tip label="Re-center">
          <IconButton label="Re-center" onClick={() => setView({ x: 0, y: 0, k: 0.62 })}>
            <ArrowsInIcon size={16} />
          </IconButton>
        </Tip>
      </div>
    </div>
  );
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/* ───────────── list ───────────── */

function MemoryList({
  decisions,
  searching,
  repoName,
  onOpen,
}: {
  decisions: Decision[];
  searching: boolean;
  repoName?: string;
  onOpen: (id: string) => void;
}) {
  if (decisions.length === 0) {
    return (
      <Empty icon={<MagnifyingGlassIcon size={22} />} title={searching ? "No matches" : "Nothing here"}>
        {searching ? "Try fewer words, or a file or PR number." : null}
      </Empty>
    );
  }
  return (
    <ul className="ui-rows mem-list">
      {decisions.map((d) => (
        <li key={d.id}>
          <button type="button" className="ui-row" onClick={() => onOpen(d.id)}>
            <span className="ui-row-icon" data-tone={d.status === "suggested" ? "amber" : undefined}>
              <ListBulletsIcon size={16} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="ui-row-title" style={{ display: "block" }}>{d.decision}</span>
              <span className="ui-row-sub">
                {SOURCE_LABEL[d.source] ?? d.source}
                {d.status === "suggested" && <Badge tone="amber">Waiting for review</Badge>}
                <EvidenceList evidence={d.evidence ?? []} repoName={repoName} max={3} />
              </span>
            </span>
            <span className="ui-row-time">{timeAgo(d.createdAt)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ───────────── decision detail ───────────── */

function DecisionSheet({
  decision,
  repoId,
  repoName,
  onClose,
  onChanged,
  onDeleted,
}: {
  decision: Decision | null;
  repoId: string;
  repoName?: string;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState<null | "save" | "approve" | "delete">(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setEditing(false);
    setText(decision?.decision ?? "");
    setWhy(decision?.why ?? "");
  }, [decision]);

  if (!decision) return <Sheet open={false} onOpenChange={() => onClose()} title="Decision">{null}</Sheet>;
  const d = decision;

  async function run<T>(kind: "save" | "approve" | "delete", fn: () => Promise<T>, done: string) {
    setBusy(kind);
    try {
      await fn();
      toast.success(done);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Sheet
        open
        onOpenChange={(v) => !v && onClose()}
        title="Decision"
        head={
          d.status === "suggested" ? <Badge tone="amber">Waiting for review</Badge> : <Badge tone="blue">Settled decision</Badge>
        }
        footer={
          editing ? (
            <>
              <Button
                variant="light"
                wide
                loading={busy === "save"}
                disabled={!text.trim()}
                onClick={async () => {
                  if (await run("save", () => updateDecision(repoId, d.id, { decision: text.trim(), why: why.trim() }), "Saved.")) {
                    setEditing(false);
                    onChanged();
                  }
                }}
              >
                Save
              </Button>
              <Button onClick={() => setEditing(false)}>Cancel</Button>
            </>
          ) : (
            <>
              {d.status === "suggested" ? (
                <Button
                  variant="light"
                  wide
                  loading={busy === "approve"}
                  icon={<CheckIcon size={15} />}
                  onClick={async () => {
                    if (await run("approve", () => reviewDecision(repoId, d.id, "approve"), "Approved. Slovey now enforces it.")) onChanged();
                  }}
                >
                  Approve
                </Button>
              ) : (
                <Link className="ui-btn ui-btn--light ui-btn--wide" href={`/app/ask?q=${encodeURIComponent(`Why do we have this rule: ${d.decision}`)}`}>
                  <ChatCircleIcon size={15} /> Ask about it
                </Link>
              )}
              <IconButton label="Edit" onClick={() => setEditing(true)}>
                <PencilSimpleIcon size={16} />
              </IconButton>
              <IconButton label="Delete" onClick={() => setConfirmDelete(true)}>
                <TrashIcon size={16} />
              </IconButton>
            </>
          )
        }
      >
        {editing ? (
          <>
            <label className="ui-field">
              <span>The decision</span>
              <textarea className="ui-textarea" style={{ minHeight: 80 }} value={text} onChange={(e) => setText(e.target.value)} />
            </label>
            <label className="ui-field">
              <span>Why</span>
              <textarea className="ui-textarea" value={why} onChange={(e) => setWhy(e.target.value)} />
            </label>
          </>
        ) : (
          <>
            <section className="ui-section">
              <div className="ui-label">The decision</div>
              <h2 className="ui-title ui-title--sm">{d.decision}</h2>
              {d.why && <p className="ui-body">{d.why}</p>}
            </section>
            {d.evidence?.length > 0 && (
              <section className="ui-section">
                <div className="ui-label">Where it came from</div>
                <EvidenceList evidence={d.evidence} repoName={repoName} max={12} />
              </section>
            )}
            {d.examples?.length > 0 && (
              <section className="ui-section">
                <div className="ui-label">Examples</div>
                {d.examples.slice(0, 4).map((ex, i) => (
                  <pre key={i} className="ui-code" style={{ whiteSpace: "pre-wrap" }}>
                    {ex}
                  </pre>
                ))}
              </section>
            )}
            <div className="ui-small">
              {SOURCE_LABEL[d.source] ?? d.source} · learned {timeAgo(d.createdAt)}
            </div>
          </>
        )}
      </Sheet>
      <Modal
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this decision?"
        description="Slovey stops enforcing it right away. This can't be undone; if it was learned from a PR, the next memory refresh may learn it again."
        actions={
          <>
            <Button onClick={() => setConfirmDelete(false)}>Keep it</Button>
            <Button
              variant="danger"
              loading={busy === "delete"}
              onClick={async () => {
                if (await run("delete", () => deleteDecision(repoId, d.id), "Deleted.")) {
                  setConfirmDelete(false);
                  onDeleted();
                }
              }}
            >
              Delete
            </Button>
          </>
        }
      />
    </>
  );
}

function AddDecision({
  open,
  onOpenChange,
  repoId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  repoId: string;
  onAdded: () => void;
}) {
  const [text, setText] = useState("");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add a decision"
      description="Write it the way you'd say it in review. Slovey enforces it on the next pull request."
      actions={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="light"
            loading={busy}
            disabled={text.trim().length < 6}
            onClick={async () => {
              setBusy(true);
              try {
                await createDecision(repoId, { decision: text.trim(), why: why.trim(), source: "manual" });
                toast.success("Added. Slovey enforces it from now on.");
                setText("");
                setWhy("");
                onOpenChange(false);
                onAdded();
              } catch (e) {
                toast.error(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Add decision
          </Button>
        </>
      }
    >
      <label className="ui-field">
        <span>The decision</span>
        <input
          className="ui-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Charge retries stay capped at 3"
          autoFocus
        />
      </label>
      <label className="ui-field">
        <span>Why (optional)</span>
        <textarea
          className="ui-textarea"
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          placeholder="More attempts go to the backoff queue, so a processor timeout can never charge a card twice."
        />
      </label>
    </Modal>
  );
}

function ImportDocs({
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
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Import docs"
      description="Paste ADRs, RFCs or a CONTRIBUTING file. Slovey pulls out the decisions in them and adds them for your review."
      actions={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="light"
            loading={busy}
            disabled={text.trim().length < 40}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await importDocs(repoId, text);
                toast.success(
                  r.inserted + r.updated > 0
                    ? `Found ${r.inserted} new and ${r.updated} updated decisions. They're in Reviews.`
                    : "No decisions found in that text.",
                );
                setText("");
                onOpenChange(false);
                onDone();
              } catch (e) {
                toast.error(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Import
          </Button>
        </>
      }
    >
      <textarea
        className="ui-textarea"
        style={{ minHeight: 220, fontFamily: "var(--mono)", fontSize: 13 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"# ADR-019: One queue for all charge jobs\n\n## Decision\nAll charge work goes through the billing queue..."}
      />
    </Modal>
  );
}
