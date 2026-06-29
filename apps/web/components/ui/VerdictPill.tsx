import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type VerdictPillProps = {
  verdict: "conflict" | "clear" | "pending";
  size?: "sm" | "md";
  className?: string;
};

const config = {
  conflict: {
    label: "Conflict",
    icon: AlertTriangle,
    className: "verdict-conflict",
  },
  clear: {
    label: "Clear",
    icon: CheckCircle,
    className: "verdict-clear",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    className: "verdict-pending",
  },
};

const sizes = {
  sm: "text-xs px-2 py-0.5 gap-1",
  md: "text-xs px-2.5 py-1 gap-1.5",
};

const iconSizes = { sm: 10, md: 12 };

export function VerdictPill({ verdict, size = "md", className }: VerdictPillProps) {
  const { label, icon: Icon, className: variantClass } = config[verdict];
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full",
        variantClass,
        sizes[size],
        className
      )}
    >
      <Icon size={iconSizes[size]} />
      {label}
    </span>
  );
}
