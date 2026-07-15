"use client";

import { useEffect, useState } from "react";
import { Link2, Loader2, RefreshCw } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

/**
 * Connect / reconnect GitHub.
 *
 * Repo access is tied to a GitHub identity (the callback populates memberships
 * from the GitHub OAuth token). Two cases:
 *  - No GitHub linked yet (e.g. signed in with Google) → `linkIdentity` attaches
 *    a GitHub account to this user, so their installations can be found.
 *  - GitHub already linked, but repos/memberships are stale (installed the App
 *    after signing in) → re-run the OAuth flow to refresh the provider token.
 *
 * Note: linking requires "Manual linking" to be enabled in the Supabase project
 * (Authentication → settings). Reconnect works regardless.
 */
export function ReconnectGitHubButton({ className = "" }: { className?: string }) {
  const supabase = createSupabaseBrowser();
  const [busy, setBusy] = useState(false);
  const [hasGithub, setHasGithub] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=/app` : undefined;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setHasGithub((data.user?.identities ?? []).some((i) => i.provider === "github"));
    });
  }, [supabase]);

  function go() {
    setBusy(true);
    setError(null);
    const run =
      hasGithub === false
        ? supabase.auth.linkIdentity({ provider: "github", options: { redirectTo } })
        : supabase.auth.signInWithOAuth({ provider: "github", options: { redirectTo } });
    run.then((res) => {
      if (res.error) {
        setBusy(false);
        setError(res.error.message);
      }
    });
  }

  const connect = hasGithub === false;

  return (
    <div className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <button
        onClick={go}
        disabled={busy}
        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--cb-text)] transition-colors hover:bg-[var(--bg-subtle)] disabled:opacity-60"
      >
        {busy ? (
          <Loader2 size={15} className="animate-spin" />
        ) : connect ? (
          <Link2 size={15} />
        ) : (
          <RefreshCw size={15} />
        )}
        {connect ? "Connect GitHub" : "Reconnect GitHub"}
      </button>
      {error && <span className="text-xs text-[var(--color-conflict)]">{error}</span>}
    </div>
  );
}
