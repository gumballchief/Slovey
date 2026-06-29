"use client";

import { cn } from "@/lib/utils";

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  id?: string;
  disabled?: boolean;
};

export function Toggle({ checked, onChange, label, id, disabled }: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className={cn("flex items-center gap-3 cursor-pointer select-none", disabled && "opacity-50 cursor-not-allowed")}
    >
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] cursor-pointer",
          checked ? "bg-[var(--primary)]" : "bg-[var(--border)]"
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute top-0.5 inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </button>
      {label && (
        <span className="text-sm text-[var(--cb-text)]">{label}</span>
      )}
    </label>
  );
}
