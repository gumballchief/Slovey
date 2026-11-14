import type Stripe from "stripe";
import { dashboard, logAudit, logger } from "@company-brain/core";
import { getStripe, webhookSecret } from "@/lib/server/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = logger.child({ component: "stripe-webhook" });

const MAX_WEBHOOK_BYTES = 1_000_000; // Stripe events are small; cap before buffering.

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
    const raw = await req.text();
    if (raw.length > MAX_WEBHOOK_BYTES) {
      return new Response("payload too large", { status: 413 });
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
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const orgId = session.metadata?.orgId;
        if (!orgId) break;
        await dashboard.setOrgStripe(orgId, {
          stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
          stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
        });
        // Only grant Pro once payment has succeeded — checkout.session.completed
        // fires even when payment is still pending/failed (payment_status != paid).
        let paid = session.payment_status === "paid";
        if (!paid) {
          const subRef = session.subscription;
          const subId = typeof subRef === "string" ? subRef : subRef?.id;
          if (subId) {
            try {
              const sub = await getStripe().subscriptions.retrieve(subId);
              paid = sub.status === "active" || sub.status === "trialing";
            } catch {
              paid = false;
            }
          }
        }
        if (!paid) {
          log.info("checkout completed without payment, waiting for payment", { orgId });
          break;
        }
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
          await dashboard.setOrgPlan(orgId, "pro");
        } else if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) {
          if (await isStaleSubscriptionEvent(sub.customer, sub.id)) {
            log.info("ignoring stale subscription update", { orgId, subId: sub.id });
            break;
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
        await dashboard.setOrgPlan(orgId, "free");
        await dashboard.setOrgStripe(orgId, { stripeSubscriptionId: null });
        await logAudit({ orgId, action: "billing.cancelled", actorUser: "stripe", metadata: {} });
        log.info("org downgraded to free", { orgId });
        break;
      }
      default:
        break; // unhandled event types are fine
    }
  } catch (e) {
    // Processing failed on our side — 500 so Stripe retries.
    log.error("webhook processing failed", { type: event.type, error: e instanceof Error ? e.message : String(e) });
    return new Response("processing error", { status: 500 });
  }
  return new Response("ok", { status: 200 });
}

async function isStaleSubscriptionEvent(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
  subId: string,
): Promise<boolean> {
  const customerId = typeof customer === "string" ? customer : customer?.id;
  if (customerId) {
    const org = await dashboard.findOrgByStripeCustomer(customerId);
    const currentId = (org as unknown as { stripeSubscriptionId?: string | null } | null)?.stripeSubscriptionId;
    if (currentId && currentId !== subId) return true;
    try {
      const list = await getStripe().subscriptions.list({ customer: customerId, limit: 10 });
      if (list.data.some((s) => s.id !== subId && ["active", "trialing", "past_due"].includes(s.status))) {
        return true;
      }
    } catch {
      // If the live check fails, fall through and apply the event.
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
