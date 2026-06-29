"use client";

import { useEffect, useState } from "react";
import { useRepo } from "@/app/app/RepoProvider";
import { fetchOrg, type OrgOverview } from "@/lib/api-client";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelativeTime } from "@/lib/utils";
import { Building2, Users, ScrollText, ShieldCheck } from "lucide-react";

const ROLE_VARIANT: Record<string, "primary" | "approved" | "default" | "suggested"> = {
  owner: "primary",
  admin: "approved",
  member: "default",
  viewer: "suggested",
};

// Humanize "pr.commented" → "PR commented", "decision.created" → "Decision created".
function humanizeAction(action: string): string {
  const [scope, verb] = action.split(".");
  const head = scope === "pr" ? "PR" : scope ? scope[0]!.toUpperCase() + scope.slice(1) : action;
  return verb ? `${head} ${verb.replace(/_/g, " ")}` : head;
}

export default function OrgPage() {
  const { activeRepoId } = useRepo();
  const [data, setData] = useState<OrgOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const d = await fetchOrg(activeRepoId);
        if (!cancelled) setData(d);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeRepoId]);

  const org = data?.org ?? null;
  const members = data?.members ?? [];
  const audit = data?.audit ?? [];
  const viewer = data?.viewer;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Org header */}
      <section className="card p-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-[var(--primary-soft)] flex items-center justify-center shrink-0">
            <Building2 size={18} className="text-[var(--primary)]" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-[var(--cb-text)] truncate">
              {org?.name ?? (loading ? "Loading…" : "No organization")}
            </h2>
            {org && <p className="label-mono text-xs text-[var(--text-muted)]">@{org.slug}</p>}
          </div>
        </div>
        {viewer && (
          <div className="text-right shrink-0">
            <p className="text-xs text-[var(--text-muted)] mb-1">Your role</p>
            <Badge variant={ROLE_VARIANT[viewer.role] ?? "default"}>
              <ShieldCheck size={11} />
              {viewer.role}
            </Badge>
          </div>
        )}
      </section>

      {/* Members */}
      <section className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-[var(--text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--cb-text)]">
            Members <span className="text-[var(--text-muted)] font-normal">({members.length})</span>
          </h3>
        </div>
        {members.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">
            {loading ? "Loading members…" : "No members linked yet. Members appear after they sign in with GitHub."}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5">
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatarUrl} alt="" className="w-7 h-7 rounded-full shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[var(--bg-subtle)] shrink-0" />
                )}
                <span className="text-sm text-[var(--cb-text)] flex-1 truncate">@{m.login}</span>
                <span className="text-xs text-[var(--text-muted)] hidden sm:block">
                  joined {formatRelativeTime(m.joinedAt)}
                </span>
                <Badge variant={ROLE_VARIANT[m.role] ?? "default"}>{m.role}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Audit log */}
      <section className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ScrollText size={15} className="text-[var(--text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--cb-text)]">Activity Log</h3>
        </div>
        {audit.length === 0 ? (
          <EmptyState
            icon={<ScrollText size={22} />}
            title="No activity yet"
            description="Audited actions (checks, decisions, syncs) will appear here."
          />
        ) : (
          <ul className="space-y-1">
            {audit.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-[var(--bg-subtle)]"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] shrink-0" />
                <span className="text-sm text-[var(--cb-text)] truncate">
                  {humanizeAction(a.action)}
                  {a.targetType && (
                    <span className="text-[var(--text-muted)]">
                      {" "}
                      · {a.targetType}
                      {a.targetId ? ` ${a.targetId.slice(0, 8)}` : ""}
                    </span>
                  )}
                </span>
                <span className="label-mono text-xs text-[var(--text-muted)] ml-auto shrink-0">
                  {a.actorUser ?? "system"}
                </span>
                <span className="text-xs text-[var(--text-muted)] shrink-0 hidden sm:block">
                  {formatRelativeTime(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
