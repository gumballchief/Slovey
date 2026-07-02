import type Stripe from "stripe";
import { dashboard, logAudit, logger } from "@company-brain/core";
import { getStripe, webhookSecret } from "@/lib/server/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = logger.child({ component: "stripe-webhook" });

/**
 * Stripe webhook — the single source of truth for plan changes. Signature-
 * verified; unknown orgs/customers are logged and acked (Stripe retries only
 * on non-2xx, and retrying an unknown customer never helps).
 */
export async function POST(req: Request): Promise<Response> {
  let event: Stripe.Event;
  try {
    const raw = await req.text();
    const signature = req.headers.get("stripe-signature") ?? "";
    event = await getStripe().webhooks.constructEventAsync(raw, signature, webhookSecret());
  } catch (e) {
    log.warn("webhook rejected", { error: e instanceof Error ? e.message : String(e) });
    return new Response("invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const orgId = session.metadata?.orgId;
        if (!orgId) break;
        await dashboard.setOrgStripe(orgId, {
          stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
          stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
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
          await dashboard.setOrgPlan(orgId, "pro");
        } else if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) {
          await dashboard.setOrgPlan(orgId, "free");
          await logAudit({ orgId, action: "billing.downgraded", actorUser: "stripe", metadata: { status: sub.status } });
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const orgId = sub.metadata?.orgId ?? (await orgFromCustomer(sub.customer));
        if (!orgId) break;
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

async function orgFromCustomer(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): Promise<string | null> {
  const id = typeof customer === "string" ? customer : customer?.id;
  if (!id) return null;
  const org = await dashboard.findOrgByStripeCustomer(id);
  return org?.id ?? null;
}
