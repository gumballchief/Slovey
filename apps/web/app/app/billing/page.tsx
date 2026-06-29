"use client";

import { useEffect, useState } from "react";
import { useRepo } from "@/app/app/RepoProvider";
import { fetchBilling, changePlan, type Billing, type OrgPlan } from "@/lib/api-client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Check, Zap } from "lucide-react";

const PLANS: Array<{
  id: OrgPlan;
  name: string;
  price: string;
  blurb: string;
  features: string[];
}> = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    blurb: "For solo projects and trying things out.",
    features: ["1 repository", "200 decisions", "PR conflict checks", "Community support"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$49",
    blurb: "For teams that ship fast and want fewer regressions.",
    features: ["10 repositories", "5,000 decisions", "Scheduled rescans", "Connectors (Linear/Notion/Slack)", "Email support"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    blurb: "For orgs with strict isolation and audit needs.",
    features: ["Unlimited repos & decisions", "SAML/SSO", "Audit log export", "RBAC + SLA", "Dedicated support"],
  },
];

function pct(used: number, limit: number): number {
  if (limit < 0) return 0;
  if (limit === 0) return 100;
  return Math.min(100, Math.round((used / limit) * 100));
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = limit < 0;
  const p = pct(used, limit);
  const over = !unlimited && used >= limit;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[var(--text-muted)]">{label}</span>
        <span className={over ? "text-[#F43F5E]" : "text-[var(--cb-text)]"}>
          {used}
          {unlimited ? "" : ` / ${limit}`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: unlimited ? "8%" : `${p}%`,
            background: over ? "#F43F5E" : "var(--primary)",
          }}
        />
      </div>
    </div>
  );
}

export default function BillingPage() {
  const { activeRepoId } = useRepo();
  const [data, setData] = useState<Billing | null>(null);
  const [busy, setBusy] = useState<OrgPlan | null>(null);

  function load() {
    fetchBilling(activeRepoId).then(setData);
  }
  useEffect(load, [activeRepoId]);

  async function selectPlan(plan: OrgPlan) {
    if (!data || plan === data.plan) return;
    setBusy(plan);
    try {
      const updated = await changePlan(activeRepoId, plan);
      setData((d) => (d ? { ...d, ...updated } : d));
    } catch {
      /* surfaced via no state change */
    } finally {
      setBusy(null);
    }
  }

  const current = data?.plan ?? "free";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Current usage */}
      <section className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--cb-text)]">
              Current plan
              <Badge variant="primary" className="ml-2 capitalize">
                {current}
              </Badge>
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {data?.org.name ? `Organization: ${data.org.name}` : "Usage this period"}
            </p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Meter label="Repositories" used={data?.usage.repos ?? 0} limit={data?.limits.repos ?? 1} />
          <Meter
            label="Decisions in memory"
            used={data?.usage.decisions ?? 0}
            limit={data?.limits.decisions ?? 200}
          />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--text-muted)] pt-1">
          <span>{data?.usage.members ?? 0} members</span>
          <span>{data?.usage.prsChecked ?? 0} PRs checked</span>
          <span>{data?.usage.conflictsCaught ?? 0} conflicts caught</span>
        </div>
      </section>

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === current;
          return (
            <section
              key={plan.id}
              className={`card p-5 flex flex-col gap-4 ${
                isCurrent ? "border-[var(--primary)] ring-1 ring-[var(--primary)]/30" : ""
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[var(--cb-text)]">{plan.name}</h3>
                  {isCurrent && <Badge variant="approved">Current</Badge>}
                </div>
                <p className="mt-2">
                  <span className="font-display text-2xl font-semibold text-[var(--cb-text)]">
                    {plan.price}
                  </span>
                  {plan.price !== "Custom" && (
                    <span className="text-xs text-[var(--text-muted)]"> / mo</span>
                  )}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{plan.blurb}</p>
              </div>
              <ul className="space-y-1.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-[var(--cb-text)]">
                    <Check size={13} className="text-[var(--primary)] mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant={isCurrent ? "secondary" : "primary"}
                size="sm"
                disabled={isCurrent || busy !== null}
                onClick={() => selectPlan(plan.id)}
              >
                {isCurrent ? (
                  "Active"
                ) : busy === plan.id ? (
                  <>
                    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Switching…
                  </>
                ) : (
                  <>
                    <Zap size={13} />
                    {plan.id === "enterprise" ? "Contact sales" : `Switch to ${plan.name}`}
                  </>
                )}
              </Button>
            </section>
          );
        })}
      </div>

      <p className="text-xs text-[var(--text-muted)] text-center">
        Plan switching is instant and not connected to a payment processor in this build.
      </p>
    </div>
  );
}
