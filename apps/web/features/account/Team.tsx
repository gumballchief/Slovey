"use client";

import { ClockCounterClockwiseIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { fetchOrg, type AuditEntry } from "@/lib/api-client";
import { NeedsRepo, Page } from "@/features/shell/Page";
import { useData } from "@/features/use-data";
import { Badge, Empty, ErrorState, RowsSkeleton, timeAgo } from "@/ui/kit";

export function Team() {
  return (
    <Page eyebrow="Team" title="People and activity" intro="Members come from your GitHub organization. Roles follow GitHub: change someone's access there and it updates here on their next sign-in." narrow>
      <NeedsRepo>{(repoId) => <TeamFor repoId={repoId} />}</NeedsRepo>
    </Page>
  );
}

/** Audit actions in plain words. Unknown ones fall back to the raw action name. */
const ACTION: Record<string, string> = {
  "installation.synced": "Synced the GitHub installation",
  "installation.deactivated": "The GitHub app was removed",
  "billing.checkout_started": "Started a checkout",
  "billing.subscribed": "Subscribed to Team",
  "billing.plan_changed": "Changed the plan",
  "billing.downgraded": "Moved back to Starter",
  "billing.cancelled": "Cancelled the subscription",
  "decision.create": "Added a decision",
  "decision.update": "Edited a decision",
  "decision.remove": "Deleted a decision",
  "import.docs": "Imported decisions from docs",
  "settings.update": "Changed repository settings",
  "token.create": "Created a CLI token",
  "token.revoke": "Revoked a CLI token",
  "connector.connected": "Connected a tool",
  "connector.disconnected": "Disconnected a tool",
  "memory.rebuild": "Re-learned memory from history",
};

function describe(a: AuditEntry): string {
  return ACTION[a.action] ?? a.action.replace(/[._]/g, " ");
}

function TeamFor({ repoId }: { repoId: string }) {
  const org = useData(repoId, () => fetchOrg(repoId));
  if (org.loading) return <RowsSkeleton rows={4} />;
  if (org.error != null) return <ErrorState error={org.error} onRetry={org.reload} title="Your team didn't load" />;
  const d = org.data!;

  return (
    <div style={{ display: "grid", gap: 44 }}>
      <section className="ui-section">
        <div className="ui-section-head">
          <h2 className="ui-title ui-title--sm">{d.org?.name ?? "Members"}</h2>
          <span className="ui-small">You&apos;re {d.viewer.role === "owner" ? "an owner" : `a ${d.viewer.role}`}</span>
        </div>
        {d.members.length === 0 ? (
          <Empty icon={<UsersThreeIcon size={22} />} title="Just you so far">
            Teammates show up here after they sign in to Slovey with GitHub.
          </Empty>
        ) : (
          <ul className="ui-rows">
            {d.members.map((m) => (
              <li key={m.id} className="ui-row" style={{ cursor: "default", alignItems: "center" }}>
                <span className="app-avatar" style={{ width: 34, height: 34, fontSize: 13 }} aria-hidden>
                  {m.avatarUrl ? <img src={m.avatarUrl} alt="" /> : m.login.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <span className="ui-row-title" style={{ display: "block" }}>{m.login}</span>
                  <span className="ui-row-sub">Joined {timeAgo(m.joinedAt)}</span>
                </span>
                <Badge tone={m.role === "owner" ? "blue" : undefined}>{m.role}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ui-section">
        <h2 className="ui-title ui-title--sm">Activity</h2>
        {d.audit.length === 0 ? (
          <Empty icon={<ClockCounterClockwiseIcon size={22} />} title="No activity yet" />
        ) : (
          <ul className="ui-rows">
            {d.audit.slice(0, 60).map((a) => (
              <li key={a.id} className="ui-row" style={{ cursor: "default", gridTemplateColumns: "1fr auto" }}>
                <span>
                  <span className="ui-row-title" style={{ display: "block", fontWeight: 500 }}>{describe(a)}</span>
                  <span className="ui-row-sub">{a.actorUser === "system" ? "Slovey" : (a.actorUser ?? "Someone")}</span>
                </span>
                <span className="ui-row-time">{timeAgo(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
