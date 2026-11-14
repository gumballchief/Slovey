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
import { fetchBilling, openBillingPortal, startCheckout } from "@/lib/api-client";
import { NeedsRepo } from "@/features/shell/Page";
import { useData } from "@/features/use-data";
import { Button, ErrorState, IconButton, Segmented, Skeleton, errorMessage } from "@/ui/kit";

/* Slovey's own checkout page. Stripe runs the payment (Checkout Sessions with
   ui_mode "elements" + the Payment Element); everything around the card form is ours. */

const PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = PK ? loadStripe(PK) : null;

type Interval = "annual" | "monthly";
const PRICE = { annual: 19, monthly: 24 } as const;
const FEATURES = [
  "Unlimited repositories",
  "The full decision graph",
  "Company rule enforcement on every pull request",
  "MCP server and API access",
  "Slack, Notion, Jira and GitHub connectors",
];

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
  const [interval, setPeriod] = useState<Interval>(params.get("interval") === "monthly" ? "monthly" : "annual");
  const [seats, setSeats] = useState<number | null>(null);

  // Start from the team's current size once we know it.
  useEffect(() => {
    if (seats == null && billing.data) setSeats(Math.max(1, Math.min(100, billing.data.usage.members || 1)));
  }, [billing.data, seats]);

  // Changing seats or the billing period makes a fresh checkout, after a short pause.
  const want = seats == null ? null : `${interval}|${seats}`;
  const [settled, setSettled] = useState<string | null>(null);
  useEffect(() => {
    if (!want) return;
    const t = setTimeout(() => setSettled(want), settled ? 450 : 0);
    return () => clearTimeout(t);
  }, [want, settled]);

  const clientSecret = useMemo(() => {
    if (!settled || !stripePromise) return null;
    const [i, s] = settled.split("|");
    return startCheckout(repoId, i as Interval, Number(s))
      .then((r) => r.clientSecret)
      .catch((e: unknown) => {
        throw new Error(errorMessage(e));
      });
  }, [repoId, settled]);

  if (billing.loading || seats == null) {
    if (billing.error != null) return <ErrorState error={billing.error} onRetry={billing.reload} title="Your plan didn't load" />;
    return <Skeleton h={420} r={18} />;
  }
  if (billing.error != null) return <ErrorState error={billing.error} onRetry={billing.reload} title="Your plan didn't load" />;
  if (billing.data && billing.data.plan !== "free") return <AlreadyPaid repoId={repoId} plan={billing.data.plan} />;

  const unit = PRICE[interval];
  const perPeriod = interval === "annual" ? unit * 12 * seats : unit * seats;
  return (
    <div className="co">
      <section className="co-summary" aria-label="Your order">
        <div className="ui-eyebrow">{billing.data?.org.name ?? "Your workspace"}</div>
        <h1 className="ui-title co-plan">Team</h1>
        <p className="ui-body ui-muted">For teams shipping with AI every day.</p>

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
        <div className="co-row">
          <span>
            Seats <em>one per person who opens pull requests</em>
          </span>
          <div className="co-seats">
            <IconButton label="One fewer seat" small disabled={seats <= 1} onClick={() => setSeats((s) => Math.max(1, (s ?? 1) - 1))}>
              <MinusIcon size={14} />
            </IconButton>
            <output aria-live="polite">{seats}</output>
            <IconButton label="One more seat" small disabled={seats >= 100} onClick={() => setSeats((s) => Math.min(100, (s ?? 1) + 1))}>
              <PlusIcon size={14} />
            </IconButton>
          </div>
        </div>

        <dl className="co-lines">
          <div>
            <dt>
              ${unit} × {seats} {seats === 1 ? "seat" : "seats"}
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

        <ul className="co-features">
          {FEATURES.map((f) => (
            <li key={f}>
              <CheckIcon size={14} weight="bold" /> {f}
            </li>
          ))}
        </ul>
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
            <PayForm interval={interval} pending={want !== settled} />
          </CheckoutElementsProvider>
        ) : (
          <PaySkeleton />
        )}
      </section>
    </div>
  );
}

function PaySkeleton() {
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

function PayForm({ interval, pending }: { interval: Interval; pending: boolean }) {
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
        Start Team plan · {total} / {per}
      </Button>
      <p className="co-fine">
        <LockSimpleIcon size={13} /> You&apos;re charged {total} today, then every {per} until you cancel. Cancel anytime in
        Billing. Card details are encrypted and handled by Stripe; Slovey never sees them.
      </p>
    </form>
  );
}

function AlreadyPaid({ repoId, plan }: { repoId: string; plan: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="co-done">
      <h1 className="ui-title">You&apos;re on {plan === "enterprise" ? "Enterprise" : "Team"}.</h1>
      <p className="ui-body ui-muted">This workspace already has a paid plan. Change seats, cards or invoices in Billing.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <Link className="ui-btn ui-btn--light" href="/app">
          Open Slovey
        </Link>
        {plan === "pro" && (
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const { url } = await openBillingPortal(repoId);
                window.location.assign(url);
              } catch {
                setBusy(false);
              }
            }}
          >
            Manage billing
          </Button>
        )}
      </div>
    </div>
  );
}
