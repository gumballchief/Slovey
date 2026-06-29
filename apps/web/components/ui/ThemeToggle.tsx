"use client";

import { Moon, Sun } from "lucide-react";
import { useTransition } from "react";

export function ThemeToggle({ isDark }: { isDark: boolean }) {
  const [, startTransition] = useTransition();

  function toggle() {
    const newTheme = isDark ? "light" : "dark";
    // Set cookie directly from client for instant response
    document.cookie = `theme=${newTheme};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;

    startTransition(() => {
      if (newTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    });
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-muted)] hover:text-[var(--cb-text)] hover:bg-[var(--bg-subtle)] transition-colors duration-150 cursor-pointer"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
