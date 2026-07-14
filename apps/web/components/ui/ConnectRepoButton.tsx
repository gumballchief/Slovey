"use client";

import { GitBranch } from "lucide-react";
import { GITHUB_APP_INSTALL_URL } from "@/lib/github-app";

/**
 * CTA out of the "no repository connected" dead-end: installing the Slovey
 * GitHub App on a repo is what actually connects it. Installation completes on
 * GitHub and the repo appears here after the webhook sync.
 */
export function ConnectRepoButton({ className = "" }: { className?: string }) {
  return (
    <a
      href={GITHUB_APP_INSTALL_URL}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-hover)] ${className}`}
    >
      <GitBranch size={15} />
      Connect a repository
    </a>
  );
}
