"use client";

import { cn } from "@/lib/utils";
import { type ReactNode } from "react";
import { useCountUp } from "@/lib/useCountUp";

type StatProps = {
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  icon?: ReactNode;
  className?: string;
};

/** Split "23h" → { num: 23, suffix: "h" }, "187" → { num: 187, suffix: "" } */
function parseValue(value: string | number): { num: number; suffix: string } {
  const str = String(value);
  const match = str.match(/^(\d+)(.*)$/);
  if (!match) return { num: NaN, suffix: str };
  return { num: parseInt(match[1], 10), suffix: match[2] };
}

export function Stat({ label, value, trend, trendUp, icon, className }: StatProps) {
  const { num, suffix } = parseValue(value);
  const { ref, value: animated } = useCountUp(Number.isNaN(num) ? 0 : num);
  const display = Number.isNaN(num) ? String(value) : `${animated}${suffix}`;

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={cn("card card-hover p-5 flex flex-col gap-3", className)}
    >
      <div className="flex items-center justify-between">
        <span className="label-mono text-[var(--text-muted)]">
          {label}
        </span>
        {icon && (
          <span className="w-8 h-8 rounded-lg bg-[var(--primary-soft)] flex items-center justify-center text-[var(--primary)]">
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="font-mono text-3xl font-semibold text-[var(--cb-text)] leading-none tracking-tight tabular-nums">
          {display}
        </span>
        {trend && (
          <span
            className={cn(
              "text-xs font-medium mb-0.5",
              trendUp ? "text-emerald-500" : "text-[var(--text-muted)]"
            )}
          >
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
