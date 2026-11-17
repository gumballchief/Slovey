import type Stripe from "stripe";
import { dashboard, logAudit } from "@company-brain/core";
import { MAX_SEATS, PLANS, type PaidPlan, isPaidPlan } from "@company-brain/core/plans";
import { type Viewer, assertRepoAccessWithRole, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok, readJsonBody } from "@/lib/server/respond";
import { type BillingInterval, getStripe, planFromProductId, planItem } from "@/lib/server/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Self-serve plan switch for a workspace that already pays by card: moves the
 * live Stripe subscription to another plan, billing period or seat count in
 * place. No support ticket, no second subscription.
 *
 * GET  → the plan, billing period and seats the workspace pays for now.
 * POST → without `confirm`, previews a switch: what is charged today
 *        (prorated) and what each renewal costs. Nothing changes.
 *        With `confirm: true`, applies it. Prorations are invoiced at once: an
 *        upgrade charges the difference to the card on file now, a downgrade
 *        leaves a credit on the account for the next bills. The switch only
 *        takes effect once that payment succeeds (pending_if_incomplete); if
 *        the bank wants the buyer to confirm, the payment's client secret comes
 *        back for the browser.
 *
 * The plan is set here only after Stripe reports the subscription moved; the
 * webhook's customer.subscription.updated sets the same plan from the product.
 * Owner/admin only.
 */

interface Current {
  plan: PaidPlan;
  interval: BillingInterval;
  seats: number;
}

async function loadSubscription(id: string, viewer: Viewer) {
  const { role, repo } = await assertRepoAccessWithRole(id, viewer);
  if (role !== "owner" && role !== "admin") throw new HttpError(403, "Only owners or admins can change the plan");
  const org = await dashboard.getOrgForRepo(id);
  if (!org) throw new HttpError(404, "No organization for this repo");
  const state = await dashboard.getOrgStripe(org.id);
  if (!state?.stripeSubscriptionId || !state.stripeCustomerId) {
    throw new HttpError(409, "This workspace has no card subscription to change. Pick a plan at checkout instead.");
  }
  const customerId = state.stripeCustomerId;
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(state.stripeSubscriptionId);
  const subCustomer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  if (subCustomer !== customerId) throw new HttpError(409, "This subscription belongs to a different account.");
  if (sub.status !== "active" && sub.status !== "trialing") {
    throw new HttpError(409, "Your last payment didn't go through. Update your card in Manage billing, then switch plans.");
  }
  const item = sub.items.data[0];
  if (!item) throw new HttpError(409, "This subscription has nothing to change.");
  const product = typeof item.price.product === "string" ? item.price.product : item.price.product.id;
  const current: Current = {
    plan: planFromProductId(product) ?? (isPaidPlan(state.plan) ? state.plan : "pro"),
    interval: item.price.recurring?.interval === "month" ? "monthly" : "annual",
    seats: item.quantity ?? 1,
  };
  return { stripe, org, repo, customerId, sub, item, current };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    const { current, sub } = await loadSubscription(id, viewer);
    return ok({ ...current, pending: Boolean(sub.pending_update) });
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const body = await readJsonBody<{
      plan?: string;
      interval?: string;
      seats?: number | null;
      confirm?: boolean;
      prorationDate?: number | null;
    }>(req, 10_000);
    const plan = body.plan;
    if (!isPaidPlan(plan)) throw new HttpError(400, "Pick Pro, Team, Business or Scale");
    const interval: BillingInterval = body.interval === "monthly" ? "monthly" : "annual";

    const { id } = await ctx.params;
    const { stripe, org, repo, customerId, sub, item, current } = await loadSubscription(id, viewer);
    if (sub.pending_update) {
      throw new HttpError(409, "A plan change is still waiting on your bank. Finish it, or try again in a few minutes.");
    }

    const perSeat = PLANS[plan].billing === "seat";
    const seats = perSeat ? Number(body.seats ?? current.seats) : 1;
    if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) {
      throw new HttpError(400, `Seats must be a whole number from 1 to ${MAX_SEATS}`);
    }
    const target = await planItem(plan, interval, seats);
    const items: Stripe.SubscriptionUpdateParams.Item[] = [
      { id: item.id, price_data: target.price_data, quantity: target.quantity },
    ];
    const renewal = target.price_data.unit_amount * target.quantity;
    const same =
      plan === current.plan &&
      interval === current.interval &&
      target.quantity === (item.quantity ?? 1) &&
      item.price.unit_amount === target.price_data.unit_amount;

    if (!body.confirm) {
      if (same) return ok({ current, same: true, dueNow: 0, credit: 0, renewal, prorationDate: null, currency: "usd" });
      const prorationDate = Math.floor(Date.now() / 1000);
      const preview = await stripe.invoices.createPreview({
        customer: customerId,
        subscription: sub.id,
        subscription_details: { items, proration_behavior: "always_invoice", proration_date: prorationDate },
      });
      return ok({
        current,
        same: false,
        dueNow: preview.amount_due,
        credit: preview.total < 0 ? -preview.total : 0,
        renewal,
        prorationDate,
        currency: preview.currency,
      });
    }

    if (same) throw new HttpError(400, "That's already your plan.");
    // Charge exactly what the preview showed, if the preview is fresh.
    const now = Math.floor(Date.now() / 1000);
    const prorationDate =
      typeof body.prorationDate === "number" && body.prorationDate <= now && now - body.prorationDate < 3600 ? body.prorationDate : now;

    let updated: Stripe.Subscription;
    try {
      updated = await stripe.subscriptions.update(sub.id, {
        items,
        proration_behavior: "always_invoice",
        proration_date: prorationDate,
        payment_behavior: "pending_if_incomplete",
        expand: ["latest_invoice.confirmation_secret"],
      });
    } catch (e) {
      if ((e as { type?: string }).type === "StripeCardError") {
        throw new HttpError(402, "Your card was declined, so your plan didn't change. Update it in Manage billing and try again.");
      }
      throw e;
    }

    const audit = { from: current, plan, interval, seats, via: "self-serve" };
    if (updated.pending_update) {
      const invoice = updated.latest_invoice as Stripe.Invoice | null;
      await logAudit({ orgId: org.id, repoId: repo.repoId, action: "billing.plan_change_pending", actorUser: viewer.login, metadata: audit });
      return ok({ status: "requires_action" as const, clientSecret: invoice?.confirmation_secret?.client_secret ?? null });
    }
    await dashboard.setOrgPlan(org.id, plan);
    await logAudit({ orgId: org.id, repoId: repo.repoId, action: "billing.plan_changed", actorUser: viewer.login, metadata: audit });
    return ok({ status: "changed" as const, plan });
  });
}
