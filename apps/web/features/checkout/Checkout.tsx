"use client";

import "./checkout.css";
import { CheckIcon, LockSimpleIcon, MinusIcon, PlusIcon } from "@phosphor-icons/react";
import { loadStripe, type Appearance } from "@stripe/stripe-js";
import {
  CheckoutElementsProvider,
  ContactDetailsElement,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_SEATS, PAID_PLAN_IDS, PLANS, type PaidPlan, isPaidPlan, planTotal } from "@company-brain/core/plans";
import { fetchBilling, startCheckout } from "@/lib/api-client";
import { ChangePlanFor } from "./ChangePlan";
import { NeedsRepo } from "@/features/shell/Page";
import { useData } from "@/features/use-data";
import { Button, ErrorState, IconButton, Segmented, Skeleton, errorMessage } from "@/ui/kit";

/* Slovey's own checkout page. Stripe runs the payment (Checkout Sessions with
   ui_mode "elements" + the Payment Element); everything around the card form is ours. */

const PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
export const stripePromise = PK ? loadStripe(PK) : null;

export type Interval = "annual" | "monthly";

const appearance: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#3d7bff",
    colorBackground: "#0a0c18",
    colorText: "#eef0f7",
    colorTextSecondary: "#8a90a6",
    colorTextPlaceholder: "#6c7290",
    colorDanger: "#ff6b66",
    fontFamily: '"Afacad Flux", ui-sans-serif, system-ui, sans-serif',
    fontSizeBase: "15px",
    borderRadius: "12px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: "1px solid rgba(170, 190, 255, 0.16)",
      boxShadow: "none",
      padding: "12px 14px",
    },
    ".Input:focus": {
      border: "1px solid rgba(61, 123, 255, 0.6)",
      boxShadow: "0 0 0 3px rgba(61, 123, 255, 0.16)",
    },
    ".Label": { color: "#8a90a6", fontWeight: "400" },
    ".Tab": { border: "1px solid rgba(170, 190, 255, 0.16)", boxShadow: "none" },
    ".Tab--selected": { border: "1px solid rgba(61, 123, 255, 0.6)" },
  },
};
const fonts = [{ cssSrc: "https://fonts.googleapis.com/css2?family=Afacad+Flux:wght@400;500;600&display=swap" }];

export function Checkout() {
  return (
    <main className="co-main">
      <NeedsRepo>{(repoId) => <CheckoutFor repoId={repoId} />}</NeedsRepo>
    </main>
  );
}

function CheckoutFor({ repoId }: { repoId: string }) {
  const params = useSearchParams();
  const billing = useData(repoId, () => fetchBilling(repoId));
  const asked = params.get("plan");
  const [planId, setPlanId] = useState<PaidPlan>(isPaidPlan(asked) ? asked : "pro");
  const [interval, setPeriod] = useState<Interval>(params.get("interval") === "monthly" ? "monthly" : "annual");
  const [seats, setSeats] = useState<number | null>(null);
  const plan = PLANS[planId];
  const perSeat = plan.billing === "seat";

  // Start from the team's current size once we know it.
  useEffect(() => {
    if (seats == null && billing.data) setSeats(Math.max(1, Math.min(MAX_SEATS, billing.data.usage.members || 1)));
  }, [billing.data, seats]);

  // Changing the plan, seats or billing period makes a fresh checkout, after a short pause.
  // Flat plans ignore seats, so changing seats there doesn't restart checkout.
  const want = seats == null ? null : `${planId}|${interval}|${perSeat ? seats : 1}`;
  const [settled, setSettled] = useState<string | null>(null);
  useEffect(() => {
    if (!want) return;
    const t = setTimeout(() => setSettled(want), settled ? 450 : 0);
    return () => clearTimeout(t);
  }, [want, settled]);

  const clientSecret = useMemo(() => {
    if (!settled || !stripePromise || billing.data?.plan !== "free") return null;
    const [p, i, s] = settled.split("|");
    return startCheckout(repoId, p as PaidPlan, i as Interval, Number(s))
      .then((r) => r.clientSecret)
      .catch((e: unknown) => {
        throw new Error(errorMessage(e));
      });
  }, [repoId, settled, billing.data?.plan]);

  if (billing.loading || seats == null) {
    if (billing.error != null) return <ErrorState error={billing.error} onRetry={billing.reload} title="Your plan didn't load" />;
    return <Skeleton h={420} r={18} />;
  }
  if (billing.error != null) return <ErrorState error={billing.error} onRetry={billing.reload} title="Your plan didn't load" />;
  // Already paying by card: switch plans in place instead of buying a second plan.
  if (billing.data && isPaidPlan(billing.data.plan)) return <ChangePlanFor repoId={repoId} orgName={billing.data.org.name} />;
  if (billing.data && billing.data.plan !== "free") return <AlreadyPaid plan={billing.data.plan} />;

  const unit = interval === "annual" ? plan.price!.annual : plan.price!.monthly;
  const perPeriod = planTotal(planId, interval, seats);
  return (
    <div className="co">
      <section className="co-summary" aria-label="Your order">
        <div className="ui-eyebrow">{billing.data?.org.name ?? "Your workspace"}</div>
        <h1 className="ui-title co-plan">{plan.name}</h1>
        <p className="ui-body ui-muted">{plan.who}.</p>

        <PlanRows planId={planId} setPlanId={setPlanId} interval={interval} setPeriod={setPeriod} seats={seats} setSeats={setSeats} />

        <dl className="co-lines">
          <div>
            <dt>
              {perSeat ? (
                <>
                  ${unit} × {seats} {seats === 1 ? "seat" : "seats"}
                </>
              ) : (
                <>${unit} a month</>
              )}
              {interval === "annual" ? " × 12 months" : ""}
            </dt>
            <dd>${perPeriod.toLocaleString()}</dd>
          </div>
          <div className="co-total">
            <dt>Due today</dt>
            <dd>
              ${perPeriod.toLocaleString()}
              <small>{interval === "annual" ? "then every year" : "then every month"}</small>
            </dd>
          </div>
        </dl>

        <PlanFeatures planId={planId} />
      </section>

      <section className="co-pay ui-card ui-card--raised" aria-label="Payment">
        {!stripePromise ? (
          <div className="co-off">
            <div className="ui-h3">Payments aren&apos;t switched on here</div>
            <p className="ui-small">
              This copy of Slovey has no payment key set, so it can&apos;t take a card. On slovey.ai this is where you pay.
            </p>
          </div>
        ) : clientSecret ? (
          <CheckoutElementsProvider key={settled} stripe={stripePromise} options={{ clientSecret, elementsOptions: { appearance, fonts } }}>
            <PayForm planName={plan.name} interval={interval} pending={want !== settled} />
          </CheckoutElementsProvider>
        ) : (
          <PaySkeleton />
        )}
      </section>
    </div>
  );
}

/** Plan, billing period and seats: the left column of checkout and of switching plans. */
export function PlanRows({
  planId,
  setPlanId,
  interval,
  setPeriod,
  seats,
  setSeats,
}: {
  planId: PaidPlan;
  setPlanId: (p: PaidPlan) => void;
  interval: Interval;
  setPeriod: (i: Interval) => void;
  seats: number;
  setSeats: (fn: (s: number | null) => number) => void;
}) {
  const plan = PLANS[planId];
  const perSeat = plan.billing === "seat";
  return (
    <>
      <div className="co-row">
        <span>Plan</span>
        <Segmented<PaidPlan>
          label="Plan"
          value={planId}
          onChange={setPlanId}
          options={PAID_PLAN_IDS.map((id) => ({ value: id, label: PLANS[id].name }))}
        />
      </div>

      <div className="co-row">
        <span>Billing</span>
        <Segmented<Interval>
          label="Billing period"
          value={interval}
          onChange={setPeriod}
          options={[
            { value: "annual", label: "Yearly · save 20%" },
            { value: "monthly", label: "Monthly" },
          ]}
        />
      </div>
      {perSeat ? (
        <div className="co-row">
          <span>
            Seats <em>one per person who opens pull requests</em>
          </span>
          <div className="co-seats">
            <IconButton label="One fewer seat" small disabled={seats <= 1} onClick={() => setSeats((s) => Math.max(1, (s ?? 1) - 1))}>
              <MinusIcon size={14} />
            </IconButton>
            <output aria-live="polite">{seats}</output>
            <IconButton label="One more seat" small disabled={seats >= MAX_SEATS} onClick={() => setSeats((s) => Math.min(MAX_SEATS, (s ?? 1) + 1))}>
              <PlusIcon size={14} />
            </IconButton>
          </div>
        </div>
      ) : (
        <div className="co-row">
          <span>
            Users <em>one price for the whole workspace</em>
          </span>
          <span className="co-flat">Up to {plan.users} included</span>
        </div>
      )}
    </>
  );
}

export function PlanFeatures({ planId }: { planId: PaidPlan }) {
  return (
    <ul className="co-features">
      {PLANS[planId].features.map((f) => (
        <li key={f}>
          <CheckIcon size={14} weight="bold" /> {f}
        </li>
      ))}
    </ul>
  );
}

export function PaySkeleton() {
  return (
    <div style={{ display: "grid", gap: 14 }} aria-busy="true">
      <Skeleton h={14} w={90} />
      <Skeleton h={46} r={12} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Skeleton h={46} r={12} />
        <Skeleton h={46} r={12} />
      </div>
      <Skeleton h={46} r={12} />
      <Skeleton h={50} r={999} />
    </div>
  );
}

function PayForm({ planName, interval, pending }: { planName: string; interval: Interval; pending: boolean }) {
  const state = useCheckoutElements();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Decided once: the session gains an email as soon as the buyer types one, and the field
  // must not vanish under their cursor.
  const askEmail = useRef<boolean | null>(null);
  // Stripe's fields paint a few seconds after the session is ready; hold their space with a skeleton.
  const [fieldsReady, setFieldsReady] = useState(false);

  if (state.type === "loading") return <PaySkeleton />;
  if (state.type === "error") {
    return <ErrorState error={state.error.message} title="Checkout couldn't start" onRetry={() => window.location.reload()} />;
  }
  const { checkout } = state;
  if (askEmail.current === null) askEmail.current = !checkout.email;
  const total = checkout.total.total.amount;
  const per = interval === "annual" ? "year" : "month";

  return (
    <form
      className="co-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setMessage(null);
        const r = await checkout.confirm();
        // Only reached on an immediate error; on success the browser goes to the return page.
        if (r.type === "error") setMessage(r.error.message);
        setSubmitting(false);
      }}
    >
      <div className="ui-label">Payment</div>
      <div className="co-fields" data-ready={fieldsReady}>
        {!fieldsReady && (
          <div className="co-fields-skel" aria-busy="true">
            <Skeleton h={46} r={12} />
            <Skeleton h={46} r={12} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Skeleton h={46} r={12} />
              <Skeleton h={46} r={12} />
            </div>
            <Skeleton h={46} r={12} />
          </div>
        )}
        {askEmail.current && (
          <div className="co-el">
            <ContactDetailsElement />
          </div>
        )}
        <div className="co-el">
          <PaymentElement options={{ layout: "tabs" }} onReady={() => setFieldsReady(true)} />
        </div>
      </div>
      {message && (
        <div className="co-msg" role="alert">
          {message}
        </div>
      )}
      <Button type="submit" variant="light" size="lg" wide loading={submitting} disabled={!checkout.canConfirm || pending}>
        Start {planName} plan · {total} / {per}
      </Button>
      <p className="co-fine">
        <LockSimpleIcon size={13} /> You&apos;re charged {total} today, then every {per} until you cancel. Cancel anytime in
        Billing. Card details are encrypted and handled by Stripe; Slovey never sees them.
      </p>
    </form>
  );
}

/** Enterprise is sales-led, so it has nothing to buy or switch here. */
function AlreadyPaid({ plan }: { plan: string }) {
  return (
    <div className="co-done">
      <h1 className="ui-title">You&apos;re on {plan === "enterprise" ? "Enterprise" : "a paid plan"}.</h1>
      <p className="ui-body ui-muted">Your plan is set up with our team, so it already covers everything here.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <Link className="ui-btn ui-btn--light" href="/app">
          Open Slovey
        </Link>
      </div>
    </div>
  );
}
