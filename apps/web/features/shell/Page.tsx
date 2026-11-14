"use client";

import { GithubLogoIcon, PlugsConnectedIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { GITHUB_APP_INSTALL_URL } from "@/lib/github-app";
import { Empty, ErrorState, RowsSkeleton, cx } from "@/ui/kit";
import { useRepo } from "./RepoProvider";

/** Standard page frame: optional eyebrow + serif title + actions, then the content. */
export function Page({
  eyebrow,
  title,
  actions,
  intro,
  narrow,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  intro?: ReactNode;
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <main className={cx("app-main", narrow && "app-main--narrow")}>
      <div className="app-page-head">
        {eyebrow && <div className="ui-eyebrow">{eyebrow}</div>}
        <div className="row">
          <h1 className="ui-title">{title}</h1>
          {actions && <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{actions}</div>}
        </div>
        {intro && <p className="ui-body ui-muted" style={{ maxWidth: 640 }}>{intro}</p>}
      </div>
      {children}
    </main>
  );
}

/**
 * Wraps every screen that needs a repository: shows the shell's own loading and
 * error states, and the connect-a-repo empty state for a brand-new account.
 */
export function NeedsRepo({ children }: { children: (repoId: string) => ReactNode }) {
  const { repoId, loading, error, reload, repos } = useRepo();
  if (loading) return <RowsSkeleton rows={4} />;
  if (error) return <ErrorState error={error} onRetry={reload} title="Your workspace didn't load" />;
  if (!repoId || repos.length === 0) {
    return (
      <Empty
        icon={<PlugsConnectedIcon size={22} />}
        title="Connect your first repository"
        action={
          <a className="ui-btn ui-btn--light" href={GITHUB_APP_INSTALL_URL}>
            <GithubLogoIcon size={16} weight="fill" />
            Install the GitHub app
          </a>
        }
      >
        Slovey reads your merged and rejected pull requests, learns the decisions in them, and starts checking new
        changes against them. It takes about a minute.
      </Empty>
    );
  }
  return <>{children(repoId)}</>;
}
