"use client";

import { ArrowSquareOutIcon, CheckCircleIcon, LockSimpleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PLANS, type PaidPlan, isPaidPlan } from "@company-brain/core/plans";
import {
  type CurrentSubscription,
  type PlanChangePreview,
  confirmPlanChange,
  fetchCurrentSubscription,
  openBillingPortal,
  previewPlanChange,
} from "@/lib/api-client";
import { useData } from "@/features/use-data";
import { Button, ErrorState, Skeleton, errorMessage } from "@/ui/kit";
import { type Interval, PlanFeatures, PlanRows, stripePromise } from "./Checkout";

/* Switching plans for a workspace that already pays by card. The subscription
   moves in place: an upgrade pays the prorated difference now, a downgrade
   leaves a credit for the next bills. No support email involved. */

const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ChangePlanFor({ repoId, orgName }: { repoId: string; orgName: string }) {
  const params = useSearchParams();
  const cur = useData(`subscription:${repoId}`, () => fetchCurrentSubscription(repoId));
  if (cur.loading) return <Skeleton h={420} r={18} />;
  if (cur.error != null) return <ErrorState error={cur.error} onRetry={cur.reload} title="Your plan didn't load" />;
  const current = cur.data!;
  const asked = params.get("plan");
  const askedInterval = params.get("interval");
  return (
    <ChangeForm
      repoId={repoId}
      orgName={orgName}
      current={current}
      initialPlan={isPaidPlan(asked) ? asked : current.plan}
      initialInterval={askedInterval === "monthly" || askedInterval === "annual" ? askedInterval : current.interval}
    />
  );
}

type Phase = "idle" | "paying" | "confirming" | "done" | "waiting";

function ChangeForm({
  repoId,
  orgName,
  current,
  initialPlan,
  initialInterval,
}: {
  repoId: string;
  orgName: string;
  current: CurrentSubscription;
  initialPlan: PaidPlan;
  initialInterval: Interval;
}) {
  const [planId, setPlanId] = useState<PaidPlan>(initialPlan);
  const [interval, setPeriod] = useState<Interval>(initialInterval);
  const [seats, setSeats] = useState<number | null>(current.seats);
  const n = seats ?? current.seats;
  const plan = PLANS[planId];
  const perSeat = plan.billing === "seat";

  // Every change to plan, period or seats re-prices the switch, after a short pause.
  const want = `${planId}|${interval}|${perSeat ? n : 1}`;
  const [settled, setSettled] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setSettled(want), settled ? 450 : 0);
    return () => clearTimeout(t);
  }, [want, settled]);

  const [preview, setPreview] = useState<{ key: string; data?: PlanChangePreview; error?: unknown } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!settled) return;
    let live = true;
    const [p, i, s] = settled.split("|");
    previewPlanChange(repoId, p as PaidPlan, i as Interval, Number(s))
      .then((data) => live && setPreview({ key: settled, data }))
      .catch((error: unknown) => live && setPreview({ key: settled, error }));
    return () => {
      live = false;
    };
  }, [repoId, settled, retry]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [busyPortal, setBusyPortal] = useState(false);
  const ready = preview?.key === want ? preview.data : undefined;
  const failed = preview?.key === want ? preview.error : undefined;
  const per = interval === "annual" ? "year" : "month";
  const from = PLANS[current.plan].name;

  async function confirm() {
    if (!ready || ready.same) return;
    setPhase("paying");
    setMessage(null);
    try {
      const r = await confirmPlanChange(repoId, planId, interval, perSeat ? n : 1, ready.prorationDate);
      if (r.status === "changed") {
        setPhase("done");
        return;
      }
      // The bank wants the buyer to confirm the payment (3D Secure).
      const stripe = await stripePromise;
      if (!stripe || !r.clientSecret) {
        setMessage("Your bank needs to confirm this payment. Open Manage billing to finish it.");
        setPhase("idle");
        return;
      }
      const res = await stripe.handleNextAction({ clientSecret: r.clientSecret });
      if (res.error) {
        setMessage(res.error.message ?? "Your bank didn't confirm the payment, so your plan didn't change.");
        setPhase("idle");
        return;
      }
      // Paid. The switch lands as soon as Stripe reports the payment; wait for it.
      setPhase("confirming");
      for (let i = 0; i < 20; i++) {
        await sleep(1500);
        const s = await fetchCurrentSubscription(repoId).catch(() => null);
        if (s && !s.pending && s.plan === planId && s.interval === interval) {
          setPhase("done");
          return;
        }
      }
      setPhase("waiting");
    } catch (e) {
      setMessage(errorMessage(e));
      setPhase("idle");
    }
  }

  if (phase === "done" || phase === "waiting") {
    return (
      <div className="co-done">
        <CheckCircleIcon size={46} weight="fill" style={{ color: "var(--green)" }} />
        <h1 className="ui-title">{phase === "done" ? `You're on ${plan.name}.` : "Payment confirmed."}</h1>
        <p className="ui-body ui-muted">
          {phase === "waiting"
            ? `Your workspace moves to ${plan.name} as soon as the payment clears, usually within a minute.`
            : ready && ready.dueNow > 0
              ? `We charged ${money(ready.dueNow, ready.currency)} to your card. The new limits are live now.`
              : ready && ready.credit > 0
                ? `${money(ready.credit, ready.currency)} of credit comes off your next bills. The new limits are live now.`
                : "The new limits are live now."}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Link className="ui-btn ui-btn--light ui-btn--lg" href="/app">
            Open Slovey
          </Link>
          <Link className="ui-btn ui-btn--lg" href="/app/billing">
            See billing
          </Link>
        </div>
      </div>
    );
  }

  const portalButton = (
    <Button
      loading={busyPortal}
      icon={<ArrowSquareOutIcon size={15} />}
      onClick={async () => {
        setBusyPortal(true);
        try {
          const { url } = await openBillingPortal(repoId);
          window.location.assign(url);
        } catch (e) {
          setMessage(errorMessage(e));
          setBusyPortal(false);
        }
      }}
    >
      Manage card and invoices
    </Button>
  );

  return (
    <div className="co">
      <section className="co-summary" aria-label="Your plan">
        <div className="ui-eyebrow">{orgName}</div>
        <h1 className="ui-title co-plan">{plan.name}</h1>
        <p className="ui-body ui-muted">
          You&apos;re on {from}, billed {current.interval === "annual" ? "yearly" : "monthly"}
          {PLANS[current.plan].billing === "seat" ? ` for ${current.seats} ${current.seats === 1 ? "seat" : "seats"}` : ""}. Switch
          whenever you like: you only pay the difference.
        </p>
        <PlanRows planId={planId} setPlanId={setPlanId} interval={interval} setPeriod={setPeriod} seats={n} setSeats={setSeats} />
        <PlanFeatures planId={planId} />
      </section>

      <section className="co-pay ui-card ui-card--raised" aria-label="Switch plan">
        {failed != null ? (
          <ErrorState error={failed} title="Couldn't price this switch" onRetry={() => setRetry((r) => r + 1)} />
        ) : !ready ? (
          <div style={{ display: "grid", gap: 14 }} aria-busy="true">
            <Skeleton h={14} w={90} />
            <Skeleton h={30} w={240} />
            <Skeleton h={120} r={12} />
            <Skeleton h={50} r={999} />
          </div>
        ) : ready.same ? (
          <div className="co-change">
            <div className="ui-label">Your plan</div>
            <div className="ui-h3">This is the plan you&apos;re on.</div>
            <p className="ui-small">
              Pick another plan, billing period or seat count on the left to see what it costs. Cards, invoices and cancelling
              are in Manage billing.
            </p>
            {message && (
              <div className="co-msg" role="alert">
                {message}
              </div>
            )}
            <div>{portalButton}</div>
          </div>
        ) : (
          <div className="co-change">
            <div className="ui-label">Switch plan</div>
            <div className="ui-h3">
              {from === plan.name ? `Change your ${plan.name} plan` : `From ${from} to ${plan.name}`}
            </div>
            <dl className="co-lines">
              <div>
                <dt>Due today</dt>
                <dd>{money(ready.dueNow, ready.currency)}</dd>
              </div>
              {ready.credit > 0 && (
                <div>
                  <dt>Credit for unused time</dt>
                  <dd>{money(ready.credit, ready.currency)}</dd>
                </div>
              )}
              <div className="co-total">
                <dt>Then</dt>
                <dd>
                  {money(ready.renewal, ready.currency)}
                  <small>every {per}</small>
                </dd>
              </div>
            </dl>
            {message && (
              <div className="co-msg" role="alert">
                {message}
              </div>
            )}
            <Button variant="light" size="lg" wide loading={phase !== "idle"} disabled={settled !== want} onClick={confirm}>
              {ready.dueNow > 0 ? `Switch to ${plan.name} · pay ${money(ready.dueNow, ready.currency)}` : `Switch to ${plan.name}`}
            </Button>
            <p className="co-fine">
              <LockSimpleIcon size={13} />{" "}
              {ready.dueNow > 0
                ? `${money(ready.dueNow, ready.currency)} goes on the card you already use with Slovey today, after credit for the unused part of your current plan.`
                : ready.credit > 0
                  ? `Nothing is charged today. The ${money(ready.credit, ready.currency)} credit comes off your next bills.`
                  : "Nothing is charged today."}{" "}
              Then {money(ready.renewal, ready.currency)} every {per} until you cancel. If the payment doesn&apos;t go through,
              nothing changes.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
