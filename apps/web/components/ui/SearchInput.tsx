"use client";

import { Search, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type SearchInputProps = {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
};

export function SearchInput({ placeholder = "Search…", value, onChange, className }: SearchInputProps) {
  const [internal, setInternal] = useState("");
  const controlled = value !== undefined;
  const current = controlled ? value : internal;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!controlled) setInternal(e.target.value);
    onChange?.(e.target.value);
  }

  function clear() {
    if (!controlled) setInternal("");
    onChange?.("");
  }

  return (
    <div className={cn("relative flex items-center", className)}>
      <Search
        size={14}
        className="absolute left-3 text-[var(--text-muted)] pointer-events-none"
      />
      <input
        type="search"
        value={current}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 text-sm bg-[var(--bg-subtle)] border border-[var(--border)] rounded-lg text-[var(--cb-text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-all duration-150"
      />
      {current && (
        <button
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-2 text-[var(--text-muted)] hover:text-[var(--cb-text)] cursor-pointer"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
