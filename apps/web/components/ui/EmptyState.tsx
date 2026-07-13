import { type ReactNode } from "react";
import { LogoGlyph } from "./Logo";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-2xl bg-[var(--primary-soft)] flex items-center justify-center text-[var(--primary)] mb-4">
        {icon ?? <LogoGlyph size={22} />}
      </div>
      <h3 className="text-base font-semibold text-[var(--cb-text)] mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--text-muted)] max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
