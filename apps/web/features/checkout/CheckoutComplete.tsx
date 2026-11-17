"use client";

import { CheckCircleIcon, CircleNotchIcon, WarningCircleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PLANS } from "@company-brain/core/plans";
import { fetchCheckoutStatus, type CheckoutStatus } from "@/lib/api-client";
import { NeedsRepo } from "@/features/shell/Page";

/** Where Stripe sends the browser after payment. The plan flips when the webhook lands, so poll briefly. */
export function CheckoutComplete() {
  return (
    <main className="co-main">
      <NeedsRepo>{(repoId) => <CompleteFor repoId={repoId} />}</NeedsRepo>
    </main>
  );
}

function CompleteFor({ repoId }: { repoId: string }) {
  const sessionId = useSearchParams().get("session_id") ?? "";
  const [s, setS] = useState<CheckoutStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      setFailed(true);
      return;
    }
    let live = true;
    fetchCheckoutStatus(repoId, sessionId)
      .then((r) => {
        if (!live) return;
        setS(r);
        const settled = r.plan !== "free" || r.status === "expired" || (r.status === "complete" && r.paymentStatus === "unpaid");
        if (!settled && tries < 20) setTimeout(() => live && setTries((t) => t + 1), 1500);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [repoId, sessionId, tries]);

  const active = s != null && s.plan !== "free";
  const paidWaiting = !active && s?.status === "complete" && s.paymentStatus === "paid";
  const bad = failed || s?.status === "expired" || (s?.status === "complete" && s.paymentStatus === "unpaid");

  return (
    <div className="co-done">
      {active ? (
        <>
          <CheckCircleIcon size={46} weight="fill" style={{ color: "var(--green)" }} />
          <h1 className="ui-title">You&apos;re on {PLANS[s.plan]?.name ?? "your new plan"}.</h1>
          <p className="ui-body ui-muted">Every repository in this workspace now has the full decision graph and rule enforcement.</p>
          <Link className="ui-btn ui-btn--light ui-btn--lg" href="/app">
            Open Slovey
          </Link>
        </>
      ) : bad ? (
        <>
          <WarningCircleIcon size={46} weight="fill" style={{ color: "var(--red)" }} />
          <h1 className="ui-title">The payment didn&apos;t go through.</h1>
          <p className="ui-body ui-muted">Nothing was charged. Try again, or use a different card.</p>
          <Link className="ui-btn ui-btn--light ui-btn--lg" href="/checkout">
            Back to checkout
          </Link>
        </>
      ) : (
        <>
          <CircleNotchIcon size={40} className="ui-spin" style={{ color: "var(--ice)" }} />
          <h1 className="ui-title">{paidWaiting ? "Payment received." : "Confirming your payment."}</h1>
          <p className="ui-body ui-muted">
            {paidWaiting
              ? `Switching your workspace to ${s?.boughtPlan ? PLANS[s.boughtPlan].name : "your new plan"}. This takes a few seconds.`
              : "Hold on a moment while we confirm it."}
          </p>
          {tries >= 20 && (
            <Link className="ui-btn" href="/app/billing">
              Check Billing
            </Link>
          )}
        </>
      )}
    </div>
  );
}
