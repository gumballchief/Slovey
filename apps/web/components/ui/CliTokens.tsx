"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { createToken, fetchTokens, revokeToken, type CliToken } from "@/lib/api-client";

/**
 * Self-serve CLI tokens: an owner/admin mints a repo-scoped `cb_…` token for the
 * `companybrain` CLI / CI. The plaintext is shown ONCE (with a copy button and a
 * ready-to-paste env snippet), then only the last-4 hint is ever displayed.
 */
export function CliTokens({ repoId }: { repoId: string | null }) {
  const [tokens, setTokens] = useState<CliToken[]>([]);
  const [creating, setCreating] = useState(false);
  const [minted, setMinted] = useState<string | null>(null); // plaintext, shown once
  const [copied, setCopied] = useState<"token" | "snippet" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTokens(repoId).then((t) => !cancelled && setTokens(t));
    return () => {
      cancelled = true;
    };
  }, [repoId]);

  async function mint() {
    if (!repoId) return;
    setCreating(true);
    setError(null);
    setMinted(null);
    try {
      const r = await createToken(repoId, "cli");
      setMinted(r.token);
      setTokens(await fetchTokens(repoId));
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^POST.*?failed: \d+\s*/, "") : "Failed to create token");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (!repoId) return;
    await revokeToken(repoId, id).catch(() => {});
    setTokens(await fetchTokens(repoId));
  }

  function copy(text: string, which: "token" | "snippet") {
    void navigator.clipboard?.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  const snippet = minted
    ? `export COMPANY_BRAIN_TOKEN=${minted}\nexport COMPANY_BRAIN_API_URL=https://company-brain-web-u04w.onrender.com\ncompanybrain doctor`
    : "";

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--cb-text)]">
            <KeyRound size={15} /> CLI Tokens
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Run the Preflight gate from your machine or CI without a database — the token lets the
            <code className="mx-1 rounded bg-[var(--bg-subtle)] px-1">companybrain</code> CLI reach the
            decision graph. Repo-scoped; revoke anytime.
          </p>
        </div>
        <button
          onClick={mint}
          disabled={creating || !repoId}
          className="btn-mesh inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-60"
        >
          {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          New token
        </button>
      </div>

      {error && <p className="text-xs text-[#FF6B8A]">{error}</p>}

      {/* Just-minted token — shown once. */}
      {minted && (
        <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary-soft)] p-4 space-y-3">
          <p className="text-xs font-medium text-[var(--cb-text)]">
            Copy this token now — it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-[var(--bg)] px-3 py-2 font-mono text-xs text-[var(--cb-text)]">
              {minted}
            </code>
            <button onClick={() => copy(minted, "token")} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-2 text-xs text-[var(--cb-text)] hover:bg-[var(--bg-subtle)]">
              {copied === "token" ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Then run</p>
            <div className="flex items-start gap-2">
              <pre className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-[var(--bg)] px-3 py-2 font-mono text-[11px] leading-relaxed text-[var(--cb-text)]">{snippet}</pre>
              <button onClick={() => copy(snippet, "snippet")} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-2 text-xs text-[var(--cb-text)] hover:bg-[var(--bg-subtle)]">
                {copied === "snippet" ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing tokens. */}
      {tokens.length > 0 ? (
        <ul className="divide-y divide-[var(--border)]">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="font-mono text-xs text-[var(--cb-text)]">
                  {t.name} · cb_…{t.tokenHint}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  created {new Date(t.createdAt).toLocaleDateString()}
                  {t.lastUsedAt ? ` · last used ${new Date(t.lastUsedAt).toLocaleDateString()}` : " · never used"}
                  {t.expiresAt ? ` · expires ${new Date(t.expiresAt).toLocaleDateString()}` : ""}
                </p>
              </div>
              <button
                onClick={() => revoke(t.id)}
                aria-label="Revoke token"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[#F43F5E]/40 hover:text-[#FF6B8A]"
              >
                <Trash2 size={13} /> Revoke
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !minted && <p className="text-xs text-[var(--text-muted)]">No tokens yet.</p>
      )}
    </section>
  );
}
