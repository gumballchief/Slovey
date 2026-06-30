"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { fetchMe, type Me } from "@/lib/api-client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatRelativeTime } from "@/lib/utils";
import { Building2, LogOut, Mail, User } from "lucide-react";

const ROLE_VARIANT: Record<string, "primary" | "approved" | "default" | "suggested"> = {
  owner: "primary",
  admin: "approved",
  member: "default",
  viewer: "suggested",
};

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((m) => !cancelled && setMe(m))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const memberships = me?.memberships ?? [];

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Identity */}
      <section className="card p-5 flex items-center gap-4">
        {me?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.avatarUrl} alt="" className="w-16 h-16 rounded-full shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center shrink-0">
            <User size={24} className="text-[var(--text-muted)]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-[var(--cb-text)] truncate">
            @{me?.login ?? (loading ? "…" : "unknown")}
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-[var(--text-muted)]">
            {me?.email && (
              <span className="flex items-center gap-1">
                <Mail size={12} />
                {me.email}
              </span>
            )}
            {me?.githubId && (
              <span className="label-mono">GitHub ID {me.githubId}</span>
            )}
            {me?.isDev && <Badge variant="suggested">dev mode</Badge>}
          </div>
        </div>
      </section>

      {/* Memberships */}
      <section className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Building2 size={15} className="text-[var(--text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--cb-text)]">
            Organizations{" "}
            <span className="text-[var(--text-muted)] font-normal">({memberships.length})</span>
          </h3>
        </div>
        {memberships.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">
            {loading
              ? "Loading…"
              : me?.isDev
                ? "Running in dev mode — sign in with GitHub to see your organizations."
                : "You aren't a member of any organization yet."}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {memberships.map((m) => (
              <li key={m.orgId} className="flex items-center gap-3 py-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--primary-soft)] flex items-center justify-center shrink-0">
                  <Building2 size={14} className="text-[var(--primary)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--cb-text)] truncate">{m.orgName}</p>
                  <p className="label-mono text-xs text-[var(--text-muted)]">@{m.orgSlug}</p>
                </div>
                <span className="text-xs text-[var(--text-muted)] hidden sm:block">
                  joined {formatRelativeTime(m.joinedAt)}
                </span>
                <Badge variant={ROLE_VARIANT[m.role] ?? "default"}>{m.role}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Sign out */}
      {!me?.isDev && (
        <section className="card p-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--cb-text)]">Sign out</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">End your session on this device.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              createSupabaseBrowser()
                .auth.signOut()
                .then(() => window.location.assign("/"))
            }
          >
            <LogOut size={13} />
            Sign out
          </Button>
        </section>
      )}
    </div>
  );
}
