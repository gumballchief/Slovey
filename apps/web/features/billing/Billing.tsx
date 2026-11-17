"use client";

import { ArrowRightIcon, ArrowSquareOutIcon, CheckCircleIcon } from "@phosphor-icons/react";
import { PAID_PLAN_IDS, PLAN_IDS, PLANS, type OrgPlan } from "@company-brain/core/plans";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { fetchBilling, openBillingPortal } from "@/lib/api-client";
import { NeedsRepo, Page } from "@/features/shell/Page";
import { useData } from "@/features/use-data";
import { Badge, Button, ErrorState, Skeleton, Stat, errorMessage } from "@/ui/kit";

const unlimited = (n: number) => n < 0;
const fmt = (n: number) => n.toLocaleString("en-US");

/** "Unlimited repositories, 5,000 decisions and 500 agent runs a month." */
function limitsLine(l: { repos: number; decisions: number; agentRuns: number }): string {
  const repos = unlimited(l.repos) ? "Unlimited repositories" : `${fmt(l.repos)} ${l.repos === 1 ? "repository" : "repositories"}`;
  const decisions = unlimited(l.decisions) ? "unlimited decisions" : `${fmt(l.decisions)} decisions`;
  const runs = unlimited(l.agentRuns) ? "unlimited agent runs" : `${fmt(l.agentRuns)} agent runs a month`;
  return `${repos}, ${decisions} and ${runs}.`;
}

/** The next plan up that raises a cap, for the "close to your limit" note. */
function nextPlanUp(plan: OrgPlan): OrgPlan | null {
  const i = PLAN_IDS.indexOf(plan);
  return i >= 0 && i < PLAN_IDS.length - 1 ? PLAN_IDS[i + 1] : null;
}

function priceLabel(id: (typeof PAID_PLAN_IDS)[number]): string {
  const p = PLANS[id];
  return p.billing === "seat" ? `$${p.price!.annual} per user a month` : `$${p.price!.annual} a month, up to ${p.users} users`;
}

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
  const plan = PLANS[d.plan] ?? PLANS.free;
  const free = d.plan === "free";
  const selfServe = (PAID_PLAN_IDS as readonly string[]).includes(d.plan);
  const next = nextPlanUp(d.plan);
  const nearDecisions = !unlimited(d.limits.decisions) && d.usage.decisions >= d.limits.decisions * 0.8;
  const nearRuns = !unlimited(d.limits.agentRuns) && d.usage.agentRuns >= d.limits.agentRuns * 0.8;
  const of = (used: number, limit: number) => (unlimited(limit) ? fmt(used) : `${fmt(used)}/${fmt(limit)}`);

  return (
    <div style={{ display: "grid", gap: 40 }}>
      {params.get("checkout") === "success" && (
        <div className="ui-note ui-note--blue">
          <CheckCircleIcon size={16} weight="fill" style={{ verticalAlign: -3, marginRight: 8, color: "var(--green)" }} />
          Payment received. Your workspace is on {plan.name}.
        </div>
      )}
      <section className="ui-card ui-card--raised" style={{ padding: 26, display: "grid", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div className="ui-eyebrow">{d.org.name}</div>
            <h2 className="ui-title" style={{ fontSize: 48 }}>{plan.name}</h2>
            <p className="ui-small">
              {d.plan === "enterprise"
                ? "Your plan is managed with your account team."
                : `${free ? "Free forever. " : ""}${limitsLine(d.limits)}`}
            </p>
          </div>
          <Badge tone={free ? undefined : "blue"} dot>
            {free ? "Free" : "Active"}
          </Badge>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {selfServe && (
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
              {plan.billing === "seat" ? "Manage seats, card and invoices" : "Manage card and invoices"}
            </Button>
          )}
          {selfServe && (
            <Link className="ui-btn ui-btn--ghost" href={`/checkout?plan=${d.plan}`}>
              Change plan
            </Link>
          )}
          {d.plan !== "enterprise" && (
            <a className="ui-btn ui-btn--ghost" href="mailto:support@slovey.dev?subject=Slovey%20Enterprise">
              Talk to us about Enterprise
            </a>
          )}
        </div>
      </section>

      {(free || selfServe) && (
        <section className="ui-section">
          <div className="ui-section-head">
            <h2 className="ui-title ui-title--sm">{free ? "Upgrade" : "Switch plan"}</h2>
            <span className="ui-small">
              {free ? "Prices billed yearly. Monthly billing is at checkout." : "Switch any time. You only pay the difference."}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 14 }}>
            {PAID_PLAN_IDS.map((id) => {
              const p = PLANS[id];
              return (
                <div key={id} className="ui-card" style={{ padding: 20, display: "grid", gap: 10, alignContent: "start" }}>
                  <div className="ui-h3">{p.name}</div>
                  <div style={{ color: "var(--ink)" }}>{priceLabel(id)}</div>
                  <p className="ui-small" style={{ margin: 0 }}>
                    {p.who}. {limitsLine(p.limits)}
                  </p>
                  {id === d.plan ? (
                    <div style={{ marginTop: 4 }}>
                      <Badge tone="blue" dot>
                        Your plan
                      </Badge>
                    </div>
                  ) : (
                    <Link
                      className={`ui-btn ui-btn--sm ${free && id === "team" ? "ui-btn--light" : ""}`}
                      href={free ? `/checkout?plan=${id}&interval=annual` : `/checkout?plan=${id}`}
                      style={{ justifySelf: "start", marginTop: 4 }}
                    >
                      {free ? "Choose" : "Switch to"} {p.name} <ArrowRightIcon size={14} />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="ui-section">
        <h2 className="ui-title ui-title--sm">Usage</h2>
        <div className="ui-stats">
          <Stat n={of(d.usage.repos, d.limits.repos)} label="repositories" />
          <Stat n={of(d.usage.decisions, d.limits.decisions)} label="decisions" />
          <Stat n={of(d.usage.agentRuns, d.limits.agentRuns)} label="agent runs this month" />
          <Stat n={d.usage.members} label="members" />
          <Stat n={d.usage.prsChecked} label="pull requests checked" />
          <Stat n={d.usage.conflictsCaught} label="conflicts caught" tone={d.usage.conflictsCaught ? "red" : undefined} />
        </div>
        {(nearDecisions || nearRuns) && next && d.plan !== "enterprise" && (
          <div className="ui-note">
            You&apos;re close to the {plan.name} limit of{" "}
            {nearDecisions ? `${fmt(d.limits.decisions)} decisions` : `${fmt(d.limits.agentRuns)} agent runs a month`}.{" "}
            {PLANS[next].name} raises it to{" "}
            {nearDecisions
              ? unlimited(PLANS[next].limits.decisions)
                ? "unlimited"
                : fmt(PLANS[next].limits.decisions)
              : unlimited(PLANS[next].limits.agentRuns)
                ? "unlimited"
                : fmt(PLANS[next].limits.agentRuns)}
            .
          </div>
        )}
      </section>
    </div>
  );
}
