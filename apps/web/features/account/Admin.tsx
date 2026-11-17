"use client";

import { LockKeyIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import * as Select from "@radix-ui/react-dropdown-menu";
import { useState } from "react";
import { toast } from "sonner";
import { PLAN_IDS, PLANS } from "@company-brain/core/plans";
import { adminSetPlan, fetchAdminOrgs, type AdminOrg, type OrgPlan } from "@/lib/api-client";
import { Page } from "@/features/shell/Page";
import { useData } from "@/features/use-data";
import { Badge, Empty, ErrorState, RowsSkeleton, errorMessage, timeAgo } from "@/ui/kit";

const PLAN_NAME = (p: OrgPlan) => PLANS[p]?.name ?? p;

/** Super-admin console: every workspace, with its plan. Gated server-side by verified email. */
export function Admin() {
  const orgs = useData("admin", () => fetchAdminOrgs());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const forbidden = orgs.error instanceof Error && /^40[13]\b/.test(orgs.error.message);
  const list = (orgs.data ?? []).filter((o) =>
    !q.trim() ? true : `${o.name} ${o.slug} ${o.members.map((m) => `${m.login} ${m.email ?? ""}`).join(" ")}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  async function setPlan(o: AdminOrg, plan: OrgPlan) {
    if (plan === o.plan) return;
    setBusy(o.id);
    try {
      await adminSetPlan(o.id, plan);
      orgs.mutate((prev) => (prev ?? []).map((x) => (x.id === o.id ? { ...x, plan } : x)));
      toast.success(`${o.name} is now on ${PLAN_NAME(plan)}.`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Page eyebrow="Admin" title="Every workspace">
      {orgs.loading && <RowsSkeleton rows={5} />}
      {forbidden && (
        <Empty icon={<LockKeyIcon size={22} />} title="Admins only">
          This page is for Slovey staff.
        </Empty>
      )}
      {orgs.error != null && !forbidden && <ErrorState error={orgs.error} onRetry={orgs.reload} title="Workspaces didn't load" />}
      {orgs.data && (
        <div style={{ display: "grid", gap: 16 }}>
          <label className="ui-search" style={{ maxWidth: 420 }}>
            <MagnifyingGlassIcon size={17} />
            <span className="ui-sr">Search workspaces</span>
            <input className="ui-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, member or email" />
            <span className="trail">{list.length}</span>
          </label>
          <div className="ui-card ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th style={{ paddingTop: 14 }}>Workspace</th>
                  <th style={{ paddingTop: 14 }}>Members</th>
                  <th style={{ paddingTop: 14 }}>Repos</th>
                  <th style={{ paddingTop: 14 }}>Created</th>
                  <th style={{ paddingTop: 14 }}>Plan</th>
                </tr>
              </thead>
              <tbody>
                {list.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div style={{ color: "var(--ink)", fontWeight: 600 }}>{o.name}</div>
                      <div className="ui-small">@{o.slug}</div>
                    </td>
                    <td className="ui-small" style={{ color: "var(--text)" }}>
                      {o.members.slice(0, 3).map((m) => m.login).join(", ") || "None yet"}
                      {o.members.length > 3 ? ` +${o.members.length - 3}` : ""}
                    </td>
                    <td className="ui-mono">{o.repos}</td>
                    <td className="ui-muted">{timeAgo(o.createdAt)}</td>
                    <td>
                      <Select.Root>
                        <Select.Trigger asChild>
                          <button type="button" className="ui-btn ui-btn--sm" disabled={busy === o.id} aria-label={`Plan for ${o.name}`}>
                            <Badge tone={o.plan === "free" ? undefined : "blue"}>{PLAN_NAME(o.plan)}</Badge>
                          </button>
                        </Select.Trigger>
                        <Select.Portal>
                          <Select.Content className="ui-portal ui-menu" align="end" sideOffset={6}>
                            {PLAN_IDS.map((p) => (
                              <Select.Item key={p} className="ui-menu-item" onSelect={() => setPlan(o, p)}>
                                {PLAN_NAME(p)}
                                {p === o.plan && <span className="end ui-small">current</span>}
                              </Select.Item>
                            ))}
                          </Select.Content>
                        </Select.Portal>
                      </Select.Root>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Page>
  );
}
