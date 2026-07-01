"use client";

import { Menu, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { CommandPalette } from "./CommandPalette";
import { UserMenu } from "./UserMenu";

type TopBarProps = {
  title: string;
  isDark: boolean;
  onMenuOpen: () => void;
};

export function TopBar({ title, isDark, onMenuOpen }: TopBarProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="flex items-center gap-3 h-14 px-4 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
      {/* Mobile menu button */}
      <button
        onClick={onMenuOpen}
        aria-label="Open navigation"
        className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-muted)] hover:text-[var(--cb-text)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
      >
        <Menu size={18} />
      </button>

      <h1 className="font-display text-base font-semibold tracking-[-0.02em] text-[var(--cb-text)] hidden sm:block">
        {title}
      </h1>

      {/* Command-style search */}
      <div className="flex-1 flex justify-center sm:justify-end">
        <button
          onClick={() => setPaletteOpen(true)}
          className="group flex w-full max-w-sm cursor-pointer items-center gap-2.5 rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3.5 py-2 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface)]"
          aria-label="Open command palette"
        >
          <Search size={14} className="text-[var(--text-muted)] transition-colors group-hover:text-[var(--primary)]" />
          <span className="flex-1 text-left font-mono text-xs text-[var(--text-muted)]">
            Search decisions, PRs…
          </span>
          <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)]">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle isDark={isDark} />
        <UserMenu />
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </header>
  );
}
