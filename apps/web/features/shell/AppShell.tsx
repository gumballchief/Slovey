"use client";

import "@/ui/ui.css";
import "./shell.css";

import {
  CaretUpDownIcon,
  ChatCircleIcon,
  CheckIcon,
  CreditCardIcon,
  DotsThreeIcon,
  GearSixIcon,
  GithubLogoIcon,
  GitPullRequestIcon,
  GraphIcon,
  ListChecksIcon,
  MagnifyingGlassIcon,
  PlugsConnectedIcon,
  PlusIcon,
  RobotIcon,
  SignOutIcon,
  SparkleIcon,
  StackIcon,
  SunHorizonIcon,
  TreeStructureIcon,
  UserIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Command } from "cmdk";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ComponentType } from "react";
import { Toaster } from "sonner";
import { GITHUB_APP_INSTALL_URL } from "@/lib/github-app";
import { createSupabaseBrowser, isAuthConfigured } from "@/lib/supabase-browser";
import { Kbd, Mark, MenuContent, MenuItem, MenuLabel, MenuRoot, MenuSep, MenuTrigger } from "@/ui/kit";
import { RepoProvider, repoShortName, useRepo } from "./RepoProvider";

type IconT = ComponentType<{ size?: number; weight?: "regular" | "fill" | "bold" }>;
type NavItem = { href: string; label: string; icon: IconT; key?: string };

export const PRIMARY: NavItem[] = [
  { href: "/app", label: "Today", icon: SunHorizonIcon, key: "t" },
  { href: "/app/memory", label: "Memory", icon: GraphIcon, key: "m" },
  { href: "/app/review", label: "Reviews", icon: StackIcon, key: "r" },
  { href: "/app/ask", label: "Ask", icon: ChatCircleIcon, key: "a" },
];
export const MORE: NavItem[] = [
  { href: "/app/pull-requests", label: "Pull requests", icon: GitPullRequestIcon, key: "p" },
  { href: "/app/preflight", label: "Preflight", icon: ListChecksIcon, key: "f" },
  { href: "/app/tasks", label: "Agent tasks", icon: RobotIcon, key: "k" },
  { href: "/app/architecture", label: "Architecture", icon: TreeStructureIcon },
  { href: "/app/connectors", label: "Connectors", icon: PlugsConnectedIcon, key: "c" },
];
export const ACCOUNT: NavItem[] = [
  { href: "/app/profile", label: "Profile", icon: UserIcon },
  { href: "/app/org", label: "Team", icon: UsersThreeIcon },
  { href: "/app/billing", label: "Billing", icon: CreditCardIcon, key: "b" },
  { href: "/app/settings", label: "Settings", icon: GearSixIcon, key: "s" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <RepoProvider>
      <Tooltip.Provider>
        <Frame>{children}</Frame>
      </Tooltip.Provider>
      <Toaster position="bottom-right" toastOptions={{ className: "ui-toast" }} />
    </RepoProvider>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/app";
  const router = useRouter();
  const [palette, setPalette] = useState(false);

  // Ctrl/Cmd+K opens search; "g" then a letter jumps (g t = Today, g m = Memory ...).
  useEffect(() => {
    let gAt = 0;
    const all = [...PRIMARY, ...MORE, ...ACCOUNT];
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "g") {
        gAt = Date.now();
        return;
      }
      if (Date.now() - gAt < 900) {
        const hit = all.find((n) => n.key === e.key.toLowerCase());
        if (hit) {
          e.preventDefault();
          router.push(hit.href);
        }
        gAt = 0;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="ui app">
      <header className="app-bar">
        <div className="app-bar-left">
          <Link href="/app" className="app-logo" aria-label="Slovey home">
            <Mark size={30} />
          </Link>
          <RepoSwitcher />
        </div>
        <TopNav pathname={pathname} className="app-nav" />
        <div className="app-bar-right">
          <button type="button" className="app-search" onClick={() => setPalette(true)} aria-label="Search or ask">
            <MagnifyingGlassIcon size={16} />
            <span className="label">Search or ask</span>
            <Kbd>Ctrl K</Kbd>
          </button>
          <AccountMenu />
        </div>
      </header>
      {children}
      <TopNav pathname={pathname} className="app-nav app-tabbar" compact />
      <Palette open={palette} onOpenChange={setPalette} />
    </div>
  );
}

function TopNav({ pathname, className, compact }: { pathname: string; className: string; compact?: boolean }) {
  const { reviewCount } = useRepo();
  const moreOn = MORE.some((m) => isActive(pathname, m.href));
  return (
    <nav className={className} aria-label="Main">
      {PRIMARY.map((n) => {
        const on = isActive(pathname, n.href);
        const Icon = n.icon;
        return (
          <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined}>
            {!compact && <Icon size={16} weight={on ? "fill" : "regular"} />}
            {n.label}
            {n.href === "/app/review" && reviewCount > 0 && <span className="app-count">{reviewCount}</span>}
          </Link>
        );
      })}
      <MenuRoot>
        <MenuTrigger asChild>
          <button type="button" data-on={moreOn ? "true" : "false"} aria-label="More pages">
            <DotsThreeIcon size={18} weight="bold" />
            {!compact && "More"}
          </button>
        </MenuTrigger>
        <MenuContent align="center">
          {MORE.map((m) => {
            const Icon = m.icon;
            return (
              <MenuItem key={m.href} href={m.href} icon={<Icon size={16} />}>
                {m.label}
              </MenuItem>
            );
          })}
        </MenuContent>
      </MenuRoot>
    </nav>
  );
}

function RepoSwitcher() {
  const { repos, repo, setRepoId, loading } = useRepo();
  if (loading && !repo) return <span className="app-repo" aria-hidden style={{ width: 150 }} />;
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <button type="button" className="app-repo" aria-label="Switch repository">
          <span className="live" />
          <span className="name">{repo ? repoShortName(repo.name) : "No repository"}</span>
          <CaretUpDownIcon size={14} />
        </button>
      </MenuTrigger>
      <MenuContent align="start">
        {repos.length > 0 && <MenuLabel>Repositories</MenuLabel>}
        {repos.map((r) => (
          <MenuItem
            key={r.id}
            onSelect={() => setRepoId(r.id)}
            icon={<GithubLogoIcon size={16} />}
            end={r.id === repo?.id ? <CheckIcon size={14} /> : undefined}
          >
            {r.name}
          </MenuItem>
        ))}
        {repos.length > 0 && <MenuSep />}
        <MenuItem href={GITHUB_APP_INSTALL_URL} icon={<PlusIcon size={16} />}>
          Connect a repository
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  );
}

function AccountMenu() {
  const { me } = useRepo();
  const initial = (me?.login ?? "?").slice(0, 1).toUpperCase();
  async function signOut() {
    if (isAuthConfigured()) await createSupabaseBrowser().auth.signOut();
    window.location.assign("/");
  }
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <button type="button" className="app-avatar" aria-label="Account">
          {me?.avatarUrl ? <img src={me.avatarUrl} alt="" /> : initial}
        </button>
      </MenuTrigger>
      <MenuContent>
        <div className="app-menu-who">
          <strong>{me?.login ?? "Signed in"}</strong>
          {me?.email && <span>{me.email}</span>}
        </div>
        <MenuSep />
        {ACCOUNT.map((a) => {
          const Icon = a.icon;
          return (
            <MenuItem key={a.href} href={a.href} icon={<Icon size={16} />}>
              {a.label}
            </MenuItem>
          );
        })}
        <MenuSep />
        <MenuItem href="/docs" icon={<SparkleIcon size={16} />}>
          Docs
        </MenuItem>
        {isAuthConfigured() && (
          <MenuItem onSelect={signOut} icon={<SignOutIcon size={16} />}>
            Sign out
          </MenuItem>
        )}
      </MenuContent>
    </MenuRoot>
  );
}

function Palette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const { repos, setRepoId } = useRepo();
  const [q, setQ] = useState("");
  const go = useCallback(
    (href: string) => {
      onOpenChange(false);
      setQ("");
      router.push(href);
    },
    [onOpenChange, router],
  );
  const query = q.trim();
  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Search or ask"
      overlayClassName="cmdk-overlay"
      contentClassName="ui-portal cmdk"
      shouldFilter
    >
      <Command.Input value={q} onValueChange={setQ} placeholder="Search pages, repositories, or ask a question" />
      <Command.List>
        <Command.Empty>No matches. Press Enter on “Ask” to ask Slovey instead.</Command.Empty>
        {query && (
          <Command.Group heading="Ask">
            <Command.Item value={`ask ${query}`} onSelect={() => go(`/app/ask?q=${encodeURIComponent(query)}`)}>
              <ChatCircleIcon size={16} />
              Ask Slovey: “{query}”
            </Command.Item>
            <Command.Item value={`memory ${query}`} onSelect={() => go(`/app/memory?q=${encodeURIComponent(query)}`)}>
              <GraphIcon size={16} />
              Search memory for “{query}”
            </Command.Item>
          </Command.Group>
        )}
        <Command.Group heading="Go to">
          {[...PRIMARY, ...MORE, ...ACCOUNT].map((n) => {
            const Icon = n.icon;
            return (
              <Command.Item key={n.href} value={n.label} onSelect={() => go(n.href)}>
                <Icon size={16} />
                {n.label}
                {n.key && <span className="hint">g {n.key}</span>}
              </Command.Item>
            );
          })}
        </Command.Group>
        {repos.length > 1 && (
          <Command.Group heading="Switch repository">
            {repos.map((r) => (
              <Command.Item
                key={r.id}
                value={`repo ${r.name}`}
                onSelect={() => {
                  setRepoId(r.id);
                  onOpenChange(false);
                }}
              >
                <GithubLogoIcon size={16} />
                {r.name}
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
