"use client";

import { useEffect, useState } from "react";
import { Check, Link2, Loader2, RefreshCw } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { fetchMe } from "@/lib/api-client";

/**
 * GitHub connection status + connect/reconnect action.
 *
 * Shows the truth instead of demanding proof: if the account already has a
 * GitHub identity, say so ("GitHub connected as @login") rather than rendering
 * a "Connect GitHub" button that implies it isn't — signing in again tells the
 * user nothing they didn't already do.
 *
 * Two independent signals, either of which means connected:
 *  - Supabase: a `github` entry in user.identities (auth-level truth).
 *  - Slovey: /api/me resolved a github_id (app-level truth, what repo access
 *    actually keys off via linkUserMemberships).
 *
 * The action uses signInWithOAuth, NOT linkIdentity: linkIdentity silently
 * requires the project's "Manual linking" setting and dead-ends (spinner, no
 * redirect) when it's off. Reconnect is only a *refresh* of the provider token
 * (e.g. installed the App after signing in) — never a prerequisite to being
 * shown as connected.
 */
export function ReconnectGitHubButton({ className = "" }: { className?: string }) {
  const supabase = createSupabaseBrowser();
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [login, setLogin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=/app` : undefined;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.auth.getUser().then(({ data }) => data.user ?? null).catch(() => null),
      fetchMe().catch(() => null),
    ]).then(([user, me]) => {
      if (cancelled) return;
      const ident = (user?.identities ?? []).find((i) => i.provider === "github");
      const identLogin = (ident?.identity_data as { user_name?: string } | undefined)?.user_name;
      setConnected(!!ident || !!me?.githubId);
      setLogin(identLogin || (me?.githubId ? me.login : null) || null);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  function go() {
    setBusy(true);
    setError(null);
    supabase.auth.signInWithOAuth({ provider: "github", options: { redirectTo } }).then((res) => {
      if (res.error) {
        setBusy(false);
        setError(res.error.message);
      }
    });
  }

  // Unknown yet — a quiet placeholder rather than a wrong answer.
  if (connected === null) {
    return <div className={`h-9 w-44 animate-pulse rounded-xl bg-[var(--bg-subtle)] ${className}`} />;
  }

  if (connected) {
    return (
      <div className={`inline-flex flex-col items-start gap-1 ${className}`}>
        <div className="inline-flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#10B981]/30 bg-[#10B981]/10 px-3 py-2 text-sm font-medium text-[var(--cb-text)]">
            <Check size={15} className="text-[#10B981]" />
            GitHub connected{login ? <span className="text-[var(--text-muted)]"> as @{login}</span> : null}
          </span>
          <button
            onClick={go}
            disabled={busy}
            title="Re-run GitHub sign-in to refresh access to newly installed repositories"
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--cb-text)] disabled:opacity-60"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Reconnect
          </button>
        </div>
        {error && <span className="text-xs text-[var(--color-conflict)]">{error}</span>}
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <button
        onClick={go}
        disabled={busy}
        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--cb-text)] transition-colors hover:bg-[var(--bg-subtle)] disabled:opacity-60"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
        Connect GitHub
      </button>
      {error && <span className="text-xs text-[var(--color-conflict)]">{error}</span>}
    </div>
  );
}
