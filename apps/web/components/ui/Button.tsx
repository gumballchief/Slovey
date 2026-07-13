import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  href?: string;
  asChild?: boolean;
};

const base =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed";

const variants = {
  primary:
    "bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-hover)] shadow-sm",
  secondary:
    "bg-[var(--bg-subtle)] text-[var(--cb-text)] border border-[var(--border)] hover:bg-[var(--surface)] hover:border-[var(--primary)]",
  ghost:
    "text-[var(--text-muted)] hover:text-[var(--cb-text)] hover:bg-[var(--bg-subtle)]",
  danger:
    "bg-[var(--color-conflict)]/10 text-[var(--color-conflict)] border border-[var(--color-conflict)]/20 hover:bg-red-500/20",
};

const sizes = {
  sm: "text-xs px-3 py-1.5",
  md: "text-sm px-4 py-2",
  lg: "text-base px-6 py-3",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  disabled,
  type = "button",
  onClick,
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(base, variants[variant], sizes[size], className)}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  children,
  href,
  variant = "primary",
  size = "md",
  className,
}: ButtonProps & { href: string }) {
  return (
    <a href={href} className={cn(base, variants[variant], sizes[size], className)}>
      {children}
    </a>
  );
}
