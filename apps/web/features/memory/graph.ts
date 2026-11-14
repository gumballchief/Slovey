import type { Decision } from "@/lib/data";

/* Builds the Memory map from real data only: every decision, plus a node for each piece
   of evidence it cites (pull requests, incidents, docs). Two decisions that cite the same
   PR end up linked through it, which is what makes the map readable. */

export type NodeKind = "decision" | "pr" | "incident" | "doc";
export type GNode = {
  id: string;
  kind: NodeKind;
  label: string;
  sub: string;
  decision?: Decision;
  x: number;
  y: number;
  degree: number;
};
export type GEdge = { from: string; to: string; red: boolean };

function evidenceKey(e: string): { id: string; kind: NodeKind; label: string } | null {
  const t = e.trim();
  if (!t) return null;
  const gh = t.match(/github\.com\/[^/\s]+\/[^/\s]+\/(?:pull|issues)\/(\d+)/);
  if (gh) return { id: `pr:${gh[1]}`, kind: "pr", label: `#${gh[1]}` };
  const inc = t.match(/\b((?:INC|SEV|INCIDENT)[-_ ]?\d+)/i);
  if (inc) return { id: `inc:${inc[1]!.toUpperCase()}`, kind: "incident", label: inc[1]!.toUpperCase() };
  const pr = t.match(/#(\d+)/);
  if (pr) return { id: `pr:${pr[1]}`, kind: "pr", label: `#${pr[1]}` };
  const adr = t.match(/\b(ADR[-_ ]?\d+)/i);
  if (adr) return { id: `doc:${adr[1]!.toUpperCase()}`, kind: "doc", label: adr[1]!.toUpperCase() };
  if (/\.(md|mdx|txt)\b|docs?\//i.test(t)) {
    const name = t.split(/[\\/]/).pop()!.slice(0, 28);
    return { id: `doc:${name.toLowerCase()}`, kind: "doc", label: name };
  }
  return null;
}

/** Deterministic pseudo-random so the map looks the same on every visit. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

export function buildGraph(decisions: Decision[], maxDecisions = 90): { nodes: GNode[]; edges: GEdge[] } {
  const ranked = [...decisions].sort((a, b) => (b.evidence?.length ?? 0) - (a.evidence?.length ?? 0)).slice(0, maxDecisions);
  const nodes = new Map<string, GNode>();
  const edges: GEdge[] = [];

  for (const d of ranked) {
    nodes.set(d.id, {
      id: d.id,
      kind: "decision",
      label: d.decision,
      sub: d.status === "suggested" ? "Waiting for review" : "Decision",
      decision: d,
      x: 0,
      y: 0,
      degree: 0,
    });
  }
  for (const d of ranked) {
    const seen = new Set<string>();
    for (const e of d.evidence ?? []) {
      const k = evidenceKey(e);
      if (!k || seen.has(k.id)) continue;
      seen.add(k.id);
      if (!nodes.has(k.id)) {
        nodes.set(k.id, {
          id: k.id,
          kind: k.kind,
          label: k.label,
          sub: k.kind === "pr" ? "Pull request" : k.kind === "incident" ? "Incident" : "Doc",
          x: 0,
          y: 0,
          degree: 0,
        });
      }
      edges.push({ from: d.id, to: k.id, red: k.kind === "incident" });
    }
  }
  for (const e of edges) {
    nodes.get(e.from)!.degree++;
    nodes.get(e.to)!.degree++;
  }
  const list = [...nodes.values()];
  layout(list, edges);
  return { nodes: list, edges };
}

/** Small force layout: repulsion between every pair, springs along edges, light gravity. */
function layout(nodes: GNode[], edges: GEdge[]) {
  const n = nodes.length;
  if (n === 0) return;
  const R = 260 + Math.sqrt(n) * 60;
  nodes.forEach((p, i) => {
    const a = (i / n) * Math.PI * 2 + hash(p.id) * 0.6;
    const r = R * (p.kind === "decision" ? 0.45 : 0.9) * (0.7 + hash(`${p.id}r`) * 0.5);
    p.x = Math.cos(a) * r;
    p.y = Math.sin(a) * r * 0.7;
  });
  const index = new Map(nodes.map((p, i) => [p.id, i]));
  const links = edges.map((e) => [index.get(e.from)!, index.get(e.to)!] as const);
  const vx = new Float64Array(n);
  const vy = new Float64Array(n);
  const iters = n > 160 ? 180 : 320;
  for (let it = 0; it < iters; it++) {
    const cool = 1 - it / iters;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = nodes[i]!.x - nodes[j]!.x;
        let dy = nodes[i]!.y - nodes[j]!.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          dx = hash(`${i}-${j}`) - 0.5;
          dy = hash(`${j}-${i}`) - 0.5;
          d2 = 1;
        }
        const f = 26000 / d2;
        const d = Math.sqrt(d2);
        vx[i] += (dx / d) * f;
        vy[i] += (dy / d) * f;
        vx[j] -= (dx / d) * f;
        vy[j] -= (dy / d) * f;
      }
    }
    for (const [a, b] of links) {
      const dx = nodes[b]!.x - nodes[a]!.x;
      const dy = nodes[b]!.y - nodes[a]!.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - 190) * 0.04;
      vx[a] += (dx / d) * f;
      vy[a] += (dy / d) * f;
      vx[b] -= (dx / d) * f;
      vy[b] -= (dy / d) * f;
    }
    for (let i = 0; i < n; i++) {
      vx[i] -= nodes[i]!.x * 0.012;
      vy[i] -= nodes[i]!.y * 0.018;
      const step = Math.min(30, Math.hypot(vx[i]!, vy[i]!)) * cool;
      const len = Math.hypot(vx[i]!, vy[i]!) || 1;
      nodes[i]!.x += (vx[i]! / len) * step;
      nodes[i]!.y += (vy[i]! / len) * step;
      vx[i] = 0;
      vy[i] = 0;
    }
  }
  separate(nodes);
}

/** Card sizes as drawn (see memory.css), plus breathing room. */
function box(p: GNode): { w: number; h: number } {
  return p.kind === "decision" ? { w: 230 + 26, h: 62 + 22 } : { w: Math.max(80, p.label.length * 8 + 90) + 18, h: 30 + 18 };
}

/** Push overlapping cards apart along the shorter axis until nothing overlaps. */
function separate(nodes: GNode[]) {
  const sizes = nodes.map(box);
  for (let pass = 0; pass < 120; pass++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const ox = (sizes[i]!.w + sizes[j]!.w) / 2 - Math.abs(a.x - b.x);
        const oy = (sizes[i]!.h + sizes[j]!.h) / 2 - Math.abs(a.y - b.y);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        if (ox < oy) {
          const s = (a.x < b.x ? -1 : 1) * (ox / 2 + 0.5);
          a.x += s;
          b.x -= s;
        } else {
          const s = (a.y < b.y ? -1 : 1) * (oy / 2 + 0.5);
          a.y += s;
          b.y -= s;
        }
      }
    }
    if (!moved) break;
  }
}
