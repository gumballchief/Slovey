"use client";

import { ArrowRightIcon, ArrowSquareOutIcon, CheckCircleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { fetchBilling, openBillingPortal } from "@/lib/api-client";
import { NeedsRepo, Page } from "@/features/shell/Page";
import { useData } from "@/features/use-data";
import { Badge, Button, ErrorState, Skeleton, Stat, errorMessage } from "@/ui/kit";

const PLAN_NAME = { free: "Starter", pro: "Team", enterprise: "Enterprise" } as const;

export function Billing() {
  return (
    <Page eyebrow="Billing" title="Plan and usage" narrow>
      <NeedsRepo>{(repoId) => <BillingFor repoId={repoId} />}</NeedsRepo>
    </Page>
  );
}

function BillingFor({ repoId }: { repoId: string }) {
  const b = useData(repoId, () => fetchBilling(repoId));
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  if (b.loading) return <Skeleton h={320} r={14} />;
  if (b.error != null) return <ErrorState error={b.error} onRetry={b.reload} title="Billing didn't load" />;
  const d = b.data!;
  const free = d.plan === "free";

  return (
    <div style={{ display: "grid", gap: 40 }}>
      {params.get("checkout") === "success" && (
        <div className="ui-note ui-note--blue">
          <CheckCircleIcon size={16} weight="fill" style={{ verticalAlign: -3, marginRight: 8, color: "var(--green)" }} />
          Payment received. Your workspace is on Team.
        </div>
      )}
      <section className="ui-card ui-card--raised" style={{ padding: 26, display: "grid", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div className="ui-eyebrow">{d.org.name}</div>
            <h2 className="ui-title" style={{ fontSize: 48 }}>{PLAN_NAME[d.plan]}</h2>
            <p className="ui-small">
              {free
                ? `Free forever for one engineer: up to ${d.limits.repos} ${d.limits.repos === 1 ? "repository" : "repositories"} and ${d.limits.decisions.toLocaleString()} decisions.`
                : d.plan === "pro"
                  ? "Unlimited repositories and decisions, rule enforcement and the MCP server."
                  : "Your plan is managed with your account team."}
            </p>
          </div>
          <Badge tone={free ? undefined : "blue"} dot>
            {free ? "Free" : "Active"}
          </Badge>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {free && (
            <Link className="ui-btn ui-btn--light" href="/checkout?interval=annual">
              Upgrade to Team <ArrowRightIcon size={15} />
            </Link>
          )}
          {d.plan === "pro" && (
            <Button
              loading={busy}
              icon={<ArrowSquareOutIcon size={15} />}
              onClick={async () => {
                setBusy(true);
                try {
                  const { url } = await openBillingPortal(repoId);
                  window.location.assign(url);
                } catch (e) {
                  toast.error(errorMessage(e));
                  setBusy(false);
                }
              }}
            >
              Manage seats, card and invoices
            </Button>
          )}
          {d.plan !== "enterprise" && (
            <a className="ui-btn ui-btn--ghost" href="mailto:support@slovey.dev?subject=Slovey%20Enterprise">
              Talk to us about Enterprise
            </a>
          )}
        </div>
      </section>

      <section className="ui-section">
        <h2 className="ui-title ui-title--sm">Usage</h2>
        <div className="ui-stats">
          <Stat n={free ? `${d.usage.repos}/${d.limits.repos}` : d.usage.repos} label="repositories" />
          <Stat n={free ? `${d.usage.decisions}/${d.limits.decisions}` : d.usage.decisions.toLocaleString()} label="decisions" />
          <Stat n={d.usage.members} label="members" />
          <Stat n={d.usage.prsChecked} label="pull requests checked" />
          <Stat n={d.usage.conflictsCaught} label="conflicts caught" tone={d.usage.conflictsCaught ? "red" : undefined} />
        </div>
        {free && d.usage.decisions >= d.limits.decisions * 0.8 && (
          <div className="ui-note">
            You&apos;re close to the Starter limit of {d.limits.decisions} decisions. Team removes the limit.
          </div>
        )}
      </section>
    </div>
  );
}
