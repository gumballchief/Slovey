"use client";

import { useEffect, useState } from "react";
import { Link2, Loader2, RefreshCw } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

/**
 * Connect / reconnect GitHub.
 *
 * Slovey derives repo access from a GitHub identity: the OAuth callback lists the
 * user's App installations (needs a GitHub *provider token*) and maps them to org
 * memberships (`linkUserMemberships`). So a user must have authenticated through
 * GitHub — a Google/email-only session can never see repos.
 *
 * We use a full GitHub OAuth sign-in (`signInWithOAuth`), NOT `linkIdentity`:
 * `linkIdentity` silently requires the project's "Manual linking" setting to be
 * enabled and dead-ends (spinner, no redirect) when it isn't — which stranded
 * Google-first users on "Connect GitHub does nothing". `signInWithOAuth` always
 * runs the redirect and returns a provider token; with Supabase's same-email
 * auto-linking it attaches GitHub to the current account. Two states:
 *  - No GitHub identity yet (e.g. signed in with Google) → "Connect GitHub".
 *  - GitHub present but repos are stale (installed the App after signing in) →
 *    "Reconnect GitHub" to refresh the token and re-sync installations.
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
    supabase.auth
      .signInWithOAuth({ provider: "github", options: { redirectTo } })
      .then((res) => {
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
