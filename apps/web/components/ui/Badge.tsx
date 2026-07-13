import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  variant?: "default" | "primary" | "ghost" | "approved" | "suggested";
  className?: string;
};

const variants = {
  default: "bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border)]",
  primary: "bg-[var(--primary-soft)] text-[var(--primary-strong)]",
  ghost: "bg-transparent text-[var(--text-muted)]",
  approved: "bg-[var(--color-clear)]/10 text-[var(--color-clear)] border border-emerald-500/20",
  suggested: "bg-[var(--color-pending)]/10 text-[var(--color-pending)] border border-amber-500/20",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
