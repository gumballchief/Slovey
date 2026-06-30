"use client";

import { ChevronDown, GitBranch } from "lucide-react";
import { useState } from "react";
import { useRepo } from "@/app/app/RepoProvider";
import { cn } from "@/lib/utils";

export function RepoSwitcher() {
  const { repos, activeRepoId, setActiveRepoId } = useRepo();
  const [open, setOpen] = useState(false);
  const current = repos.find((r) => r.id === activeRepoId) ?? repos[0];

  // No repositories connected yet — honest empty state (no mock repo).
  if (!current) {
    return (
      <div className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)] text-sm text-[var(--text-muted)]">
        <GitBranch size={14} className="shrink-0" />
        No repositories
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Switch repository"
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)] hover:border-[var(--primary)] transition-colors duration-150 cursor-pointer"
      >
        <GitBranch size={14} className="text-[var(--primary)] shrink-0" />
        <span className="text-sm font-medium text-[var(--cb-text)] truncate flex-1 text-left">
          {current.name}
        </span>
        <span
          className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)] shrink-0"
          title="Synced"
          aria-label="Synced"
        />
        <ChevronDown
          size={13}
          className={cn(
            "text-[var(--text-muted)] transition-transform duration-150 shrink-0",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 card shadow-lg overflow-hidden animate-[fadeIn_0.15s_ease-out]">
          {repos.map((repo) => (
            <button
              key={repo.id}
              onClick={() => {
                setActiveRepoId(repo.id);
                setOpen(false);
              }}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer",
                repo.id === activeRepoId && "text-[var(--primary)] font-medium"
              )}
            >
              <GitBranch size={13} className="shrink-0 text-[var(--text-muted)]" />
              <span className="truncate">{repo.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
