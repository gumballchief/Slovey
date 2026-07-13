"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, BookOpen, GitPullRequest, Plug, Settings, LayoutDashboard, CornerDownLeft } from "lucide-react";
import { useRepo } from "@/app/app/RepoProvider";
import { fetchPRs, searchDecisions } from "@/lib/api-client";
import type { CheckedPR, Decision } from "@/lib/data";

type Item = {
  label: string;
  meta: string;
  href: string;
  icon: React.ReactNode;
};

const NAV: Item[] = [
  { label: "Overview", meta: "page", href: "/app", icon: <LayoutDashboard size={15} /> },
  { label: "Memory", meta: "page", href: "/app/memory", icon: <BookOpen size={15} /> },
  { label: "Pull Requests", meta: "page", href: "/app/pull-requests", icon: <GitPullRequest size={15} /> },
  { label: "Connectors", meta: "page", href: "/app/connectors", icon: <Plug size={15} /> },
  { label: "Settings", meta: "page", href: "/app/settings", icon: <Settings size={15} /> },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { activeRepoId } = useRepo();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [prs, setPrs] = useState<CheckedPR[]>([]);

  // PRs for the active repo (loaded when the palette opens).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchPRs(activeRepoId).then((p) => !cancelled && setPrs(p));
    return () => {
      cancelled = true;
    };
  }, [open, activeRepoId]);

  // Semantic decision search (debounced); falls back to substring without a DB.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(
      () => {
        searchDecisions(activeRepoId, query).then((d) => !cancelled && setDecisions(d));
      },
      query ? 180 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, query, activeRepoId]);

  const filtered = useMemo<Item[]>(() => {
    const q = query.toLowerCase();
    const navItems = NAV.filter((n) => !q || n.label.toLowerCase().includes(q));
    const decisionItems: Item[] = decisions.slice(0, 6).map((d) => ({
      label: d.decision,
      meta: d.evidence[0] ?? "decision",
      href: "/app/memory",
      icon: <BookOpen size={15} />,
    }));
    const prItems: Item[] = prs
      .filter((p) => !q || p.title.toLowerCase().includes(q) || String(p.number).includes(q))
      .slice(0, 4)
      .map((p) => ({
        label: p.title,
        meta: `PR #${p.number}`,
        href: "/app/pull-requests",
        icon: <GitPullRequest size={15} />,
      }));
    return [...navItems, ...decisionItems, ...prItems].slice(0, 10);
  }, [decisions, prs, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, filtered.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      }
      if (e.key === "Enter" && filtered[active]) {
        router.push(filtered[active].href);
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, active, onClose, router]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center pt-[12vh] px-4 bg-[rgba(27,23,38,0.4)] backdrop-blur-sm animate-[fadeIn_0.12s_ease-out]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-card-hover)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* input */}
        <div className="flex items-center gap-3 px-4 h-12 border-b border-[var(--border)]">
          <Search size={16} className="text-[var(--text-muted)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Search decisions, PRs, pages…"
            className="flex-1 bg-transparent outline-none font-mono text-sm text-[var(--cb-text)] placeholder:text-[var(--text-muted)]"
          />
          <kbd className="font-mono text-[10px] text-[var(--text-muted)] bg-[var(--bg-subtle)] border border-[var(--border)] rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        {/* results */}
        <ul className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">No results.</li>
          ) : (
            filtered.map((item, i) => (
              <li key={i}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => {
                    router.push(item.href);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                    i === active ? "bg-[var(--primary-soft)]" : "hover:bg-[var(--bg-subtle)]"
                  }`}
                >
                  <span className={i === active ? "text-[var(--primary)]" : "text-[var(--text-muted)]"}>
                    {item.icon}
                  </span>
                  <span className="flex-1 min-w-0 text-sm text-[var(--cb-text)] truncate">{item.label}</span>
                  <span className="font-mono text-[11px] text-[var(--text-muted)] shrink-0">{item.meta}</span>
                  {i === active && <CornerDownLeft size={12} className="text-[var(--primary)] shrink-0" />}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
