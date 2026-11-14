import type Stripe from "stripe";
import { dashboard, logAudit, logger } from "@company-brain/core";
import { getStripe, webhookSecret } from "@/lib/server/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = logger.child({ component: "stripe-webhook" });

const MAX_WEBHOOK_BYTES = 1_000_000; // Stripe events are small; cap before buffering.

// Serialize webhook processing so concurrent/out-of-order events for the
// same subscription cannot both pass the live-status checks before either
// writes: inside the queue the live check + setOrgPlan are atomic, so the
// final plan follows Stripe's live state, not webhook write order.
let webhookChain: Promise<unknown> = Promise.resolve();

function runSerialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = webhookChain.then(fn, fn);
  webhookChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// Newest Stripe `created` applied per subscription; an older event that
// arrives (or is retried) after a newer one for the same subscription is
// dropped instead of resurrecting the old plan.
const lastEventBySubscription = new Map<string, number>();

function subscriptionKey(event: Stripe.Event): string | null {
  const obj = event.data.object as unknown as { id?: unknown; subscription?: unknown };
  if (event.type === "checkout.session.completed") {
    if (typeof obj.subscription === "string") return obj.subscription;
    if (obj.subscription && typeof obj.subscription === "object") {
      const id = (obj.subscription as { id?: unknown }).id;
      if (typeof id === "string") return id;
    }
    return null;
  }
  return typeof obj.id === "string" ? obj.id : null;
}

/**
 * Stripe webhook — the single source of truth for plan changes. Signature-
 * verified; unknown orgs/customers are logged and acked (Stripe retries only
 * on non-2xx, and retrying an unknown customer never helps).
 */
export async function POST(req: Request): Promise<Response> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_WEBHOOK_BYTES) {
    return new Response("payload too large", { status: 413 });
  }
  let event: Stripe.Event;
  try {
    let raw: string;
    if (!req.body) {
      raw = await req.text();
      if (raw.length > MAX_WEBHOOK_BYTES) {
        return new Response("payload too large", { status: 413 });
      }
    } else {
      const reader = req.body.getReader();
      const decoder = new TextDecoder();
      let seen = 0;
      raw = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) break;
          seen += value.byteLength;
          if (seen > MAX_WEBHOOK_BYTES) {
            await reader.cancel();
            return new Response("payload too large", { status: 413 });
          }
          raw += decoder.decode(value, { stream: true });
          if (raw.length > MAX_WEBHOOK_BYTES) {
            await reader.cancel();
            return new Response("payload too large", { status: 413 });
          }
        }
        raw += decoder.decode();
      } finally {
        reader.releaseLock();
      }
    }
    const signature = req.headers.get("stripe-signature") ?? "";
    event = await getStripe().webhooks.constructEventAsync(raw, signature, webhookSecret());
  } catch (e) {
    log.warn("webhook rejected", { error: e instanceof Error ? e.message : String(e) });
    return new Response("invalid signature", { status: 400 });
  }

  try {
    // No in-memory dedupe: marking an event seen before it is applied would make
    // Stripe's retry of a failed attempt a no-op. Every handler below is idempotent.
    await runSerialized(async () => {
    const subKey = subscriptionKey(event);
    if (subKey && event.created < (lastEventBySubscription.get(subKey) ?? 0)) {
      log.info("ignoring out-of-order subscription event", { type: event.type, subId: subKey });
      return;
    }
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const orgId = session.metadata?.orgId;
        if (!orgId) break;
        const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;
        if (stripeCustomerId) {
          await dashboard.setOrgStripe(orgId, {
            stripeCustomerId,
          });
        }
        // Only grant Pro once payment has succeeded — checkout.session.completed
        // fires even when payment is still pending/failed (payment_status != paid).
        // Do not touch stripeSubscriptionId until paid is verified: overwriting it
        // with an unpaid/incomplete subscription would make later cancellations
        // of the real subscription look stale and be ignored.
        let paid = session.payment_status === "paid";
        const subRef = session.subscription;
        const subId = typeof subRef === "string" ? subRef : subRef?.id;
        if (!paid) {
          if (subId) {
            try {
              const sub = await getStripe().subscriptions.retrieve(subId);
              paid = sub.status === "active" || sub.status === "trialing";
            } catch (e) {
              // Can't verify right now (Stripe API hiccup): fail the request so
              // Stripe retries this event, instead of acking it and losing a real upgrade.
              throw e;
            }
          }
        }
        if (!paid) {
          log.info("checkout completed without payment, waiting for payment", { orgId });
          break;
        }
        // A replayed/out-of-order checkout event still reports its historical
        // paid status even after the subscription was canceled/downgraded, so
        // never grant Pro from the event alone: confirm the live subscription
        // is still current before touching stripeSubscriptionId or the plan.
        if (!subId) {
          log.info("ignoring checkout completion without subscription", { orgId });
          break;
        }
        if (await isStaleSubscriptionEvent(session.customer, subId)) {
          log.info("ignoring stale checkout completion", { orgId, subId });
          break;
        }
        try {
          const live = await getStripe().subscriptions.retrieve(subId);
          if (live.status !== "active" && live.status !== "trialing" && live.status !== "past_due") {
            log.info("ignoring stale checkout completion", { orgId, subId });
            break;
          }
        } catch (e) {
          // Can't confirm right now (Stripe API hiccup): fail the request so
          // Stripe retries this event, instead of acking it and losing a real upgrade.
          throw e;
        }
        await dashboard.setOrgStripe(orgId, {
          stripeSubscriptionId: subId,
        });
        await dashboard.setOrgPlan(orgId, "pro");
        await logAudit({ orgId, action: "billing.subscribed", actorUser: "stripe", metadata: { plan: "pro" } });
        log.info("org upgraded to pro", { orgId });
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const orgId = sub.metadata?.orgId ?? (await orgFromCustomer(sub.customer));
        if (!orgId) break;
        // active/trialing → pro; anything terminal → free. past_due keeps access
        // while Stripe retries payment (their dunning handles the nagging).
        if (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due") {
          if (await isStaleSubscriptionEvent(sub.customer, sub.id)) {
            log.info("ignoring stale subscription update", { orgId, subId: sub.id });
            break;
          }
          try {
            const live = await getStripe().subscriptions.retrieve(sub.id);
            if (live.status !== "active" && live.status !== "trialing" && live.status !== "past_due") {
              log.info("ignoring stale subscription update", { orgId, subId: sub.id });
              break;
            }
          } catch (e) {
            // Transient Stripe errors must retry (500) instead of acking and
            // losing the upgrade; only a gone/missing subscription is ignored.
            if (!isSubscriptionGoneError(e)) throw e;
            log.info("ignoring unverifiable subscription update", { orgId, subId: sub.id });
            break;
          }
          await dashboard.setOrgStripe(orgId, {
            stripeSubscriptionId: sub.id,
          });
          await dashboard.setOrgPlan(orgId, "pro");
        } else if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) {
          if (await isStaleSubscriptionEvent(sub.customer, sub.id)) {
            log.info("ignoring stale subscription update", { orgId, subId: sub.id });
            break;
          }
          try {
            const live = await getStripe().subscriptions.retrieve(sub.id);
            if (live.status === "active" || live.status === "trialing" || live.status === "past_due") {
              log.info("ignoring stale subscription update", { orgId, subId: sub.id });
              break;
            }
          } catch (e) {
            // Only a genuinely deleted/missing subscription means the cancel is
            // real. Transient Stripe errors must retry (500) instead of downgrading.
            if (!isSubscriptionGoneError(e)) throw e;
          }
          await dashboard.setOrgPlan(orgId, "free");
          await logAudit({ orgId, action: "billing.downgraded", actorUser: "stripe", metadata: { status: sub.status } });
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const orgId = sub.metadata?.orgId ?? (await orgFromCustomer(sub.customer));
        if (!orgId) break;
        if (await isStaleSubscriptionEvent(sub.customer, sub.id)) {
          log.info("ignoring stale subscription deleted", { orgId, subId: sub.id });
          break;
        }
        try {
          const live = await getStripe().subscriptions.retrieve(sub.id);
          if (live.status === "active" || live.status === "trialing" || live.status === "past_due") {
            log.info("ignoring stale subscription deleted", { orgId, subId: sub.id });
            break;
          }
        } catch (e) {
          // Only a genuinely deleted/missing subscription means the cancel is
          // real. Transient Stripe errors must retry (500) instead of downgrading.
          if (!isSubscriptionGoneError(e)) throw e;
        }
        await dashboard.setOrgPlan(orgId, "free");
        await dashboard.setOrgStripe(orgId, { stripeSubscriptionId: null });
        await logAudit({ orgId, action: "billing.cancelled", actorUser: "stripe", metadata: {} });
        log.info("org downgraded to free", { orgId });
        break;
      }
      default:
        break; // unhandled event types are fine
    }
    if (subKey) {
      lastEventBySubscription.set(subKey, Math.max(lastEventBySubscription.get(subKey) ?? 0, event.created));
    }
    });
  } catch (e) {
    // Processing failed on our side — 500 so Stripe retries.
    log.error("webhook processing failed", { type: event.type, error: e instanceof Error ? e.message : String(e) });
    return new Response("processing error", { status: 500 });
  }
  return new Response("ok", { status: 200 });
}

function isSubscriptionGoneError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const code = (e as { code?: unknown }).code;
  if (code === "resource_missing") return true;
  const statusCode = (e as { statusCode?: unknown }).statusCode;
  return statusCode === 404;
}

async function isStaleSubscriptionEvent(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
  subId: string,
): Promise<boolean> {
  const customerId = typeof customer === "string" ? customer : customer?.id;
  if (customerId) {
    const org = await dashboard.findOrgByStripeCustomer(customerId);
    const currentId = (org as unknown as { stripeSubscriptionId?: string | null } | null)?.stripeSubscriptionId;
    if (currentId && currentId !== subId) {
      try {
        const current = await getStripe().subscriptions.retrieve(currentId);
        if (["active", "trialing", "past_due"].includes(current.status)) return true;
      } catch {
        // Stored id is gone or unverifiable — fall through to the live list
        // check below so a replacement subscription can take over.
      }
    }
    try {
      const list = await getStripe().subscriptions.list({ customer: customerId, limit: 10 });
      if (list.data.some((s) => s.id !== subId && ["active", "trialing", "past_due"].includes(s.status))) {
        return true;
      }
    } catch (e) {
      // Transient list failures must retry (500); only a missing customer/subscription falls through.
      if (!isSubscriptionGoneError(e)) throw e;
    }
  }
  return false;
}

async function orgFromCustomer(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): Promise<string | null> {
  const id = typeof customer === "string" ? customer : customer?.id;
  if (!id) return null;
  const org = await dashboard.findOrgByStripeCustomer(id);
  return org?.id ?? null;
}
