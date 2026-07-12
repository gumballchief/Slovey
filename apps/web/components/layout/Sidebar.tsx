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
  Gauge,
  Bot,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { RepoSwitcher } from "./RepoSwitcher";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/app/ask", label: "Ask Brain", icon: Sparkles },
      { href: "/app/tasks", label: "Agent", icon: Bot },
      { href: "/app/memory", label: "Memory", icon: BookOpen },
      { href: "/app/review", label: "Review", icon: ShieldCheck },
      { href: "/app/architecture", label: "Architecture", icon: Network },
      { href: "/app/pull-requests", label: "Pull Requests", icon: GitPullRequest },
      { href: "/app/preflight", label: "Preflight", icon: Gauge },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/app/connectors", label: "Connectors", icon: Plug },
      { href: "/app/org", label: "Organization", icon: Building2 },
      { href: "/app/billing", label: "Billing", icon: CreditCard },
      { href: "/app/settings", label: "Settings", icon: Settings },
      { href: "/app/profile", label: "Profile", icon: User },
    ],
  },
];

type SidebarProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  const content = (
    <aside className="flex h-full w-60 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]">
          <Brain size={15} className="text-[var(--on-primary)]" />
        </div>
        <span className="font-display font-semibold tracking-[-0.02em] text-[var(--cb-text)]">
          Slovey
        </span>
        {mobileOpen && (
          <button
            onClick={onMobileClose}
            aria-label="Close sidebar"
            className="ml-auto cursor-pointer text-[var(--text-muted)] hover:text-[var(--cb-text)]"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Repo switcher */}
      <div className="px-3 pb-2">
        <RepoSwitcher />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-1">
            <p className="label-mono px-3 pb-1.5 pt-3 text-[var(--text-muted)]/70">{group.label}</p>
            <ul className="space-y-0.5" role="list">
              {group.items.map(({ href, label, icon: Icon, exact }) => {
                const active = isActive(href, exact);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onMobileClose}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-[var(--primary-soft)] font-semibold text-[var(--primary-strong)]"
                          : "font-medium text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--cb-text)]",
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-[var(--primary)]"
                        />
                      )}
                      <Icon
                        size={16}
                        className={active ? "text-[var(--primary)]" : "text-current"}
                      />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
        <span className="label-mono text-[var(--text-muted)]/70">v0.1</span>
        <span className="flex items-center gap-1.5 label-mono text-[var(--text-muted)]/70">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> live
        </span>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden h-full shrink-0 lg:flex">{content}</div>

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-[var(--cb-text)]/30 backdrop-blur-sm lg:hidden"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 flex lg:hidden">{content}</div>
        </>
      )}
    </>
  );
}
