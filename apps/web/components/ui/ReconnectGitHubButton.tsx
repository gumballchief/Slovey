"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

/**
 * Escape hatch for the ordering trap: memberships are populated from the GitHub
 * OAuth token in the auth callback, which only fires at sign-in. If someone
 * logged in BEFORE installing the App (or added repos later), their new repos
 * won't appear until they re-authenticate. Re-running the GitHub OAuth flow
 * gets a fresh provider_token so the callback re-links memberships.
 */
export function ReconnectGitHubButton({ className = "" }: { className?: string }) {
  const supabase = createSupabaseBrowser();
  const [busy, setBusy] = useState(false);
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=/app` : undefined;

  function reconnect() {
    setBusy(true);
    supabase.auth
      .signInWithOAuth({ provider: "github", options: { redirectTo } })
      .then(({ error }) => {
        if (error) setBusy(false);
      });
  }

  return (
    <button
      onClick={reconnect}
      disabled={busy}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--cb-text)] transition-colors hover:bg-[var(--bg-subtle)] disabled:opacity-60 ${className}`}
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
      Reconnect GitHub
    </button>
  );
}
