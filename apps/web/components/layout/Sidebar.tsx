"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  LayoutDashboard,
  BookOpen,
  GitPullRequest,
  Plug,
  Settings,
  Network,
  Building2,
  CreditCard,
  User,
  Sparkles,
  ShieldCheck,
  X,
} from "lucide-react";
import { RepoSwitcher } from "./RepoSwitcher";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/app/ask", label: "Ask Brain", icon: Sparkles },
  { href: "/app/memory", label: "Memory", icon: BookOpen },
  { href: "/app/review", label: "Review", icon: ShieldCheck },
  { href: "/app/architecture", label: "Architecture", icon: Network },
  { href: "/app/pull-requests", label: "Pull Requests", icon: GitPullRequest },
  { href: "/app/connectors", label: "Connectors", icon: Plug },
  { href: "/app/org", label: "Organization", icon: Building2 },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
  { href: "/app/profile", label: "Profile", icon: User },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

type SidebarProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  const content = (
    <aside className="flex flex-col h-full w-60 bg-[var(--surface)] border-r border-[var(--border)]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[var(--border)]">
        <div className="w-7 h-7 rounded-lg bg-[var(--primary)] flex items-center justify-center shrink-0">
          <Brain size={15} className="text-white" />
        </div>
        <span className="font-display font-semibold tracking-[-0.02em] text-[var(--cb-text)]">Company Brain</span>
        {mobileOpen && (
          <button
            onClick={onMobileClose}
            aria-label="Close sidebar"
            className="ml-auto text-[var(--text-muted)] hover:text-[var(--cb-text)] cursor-pointer"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Repo switcher */}
      <div className="px-3 py-3 border-b border-[var(--border)]">
        <RepoSwitcher />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Main navigation">
        <ul className="space-y-0.5" role="list">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={onMobileClose}
                className={cn(
                  "sidebar-item",
                  isActive(href, exact) && "active"
                )}
                aria-current={isActive(href, exact) ? "page" : undefined}
              >
                <Icon size={16} />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)]">Company Brain v0.1</p>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-full shrink-0">{content}</div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 flex lg:hidden">
            {content}
          </div>
        </>
      )}
    </>
  );
}
