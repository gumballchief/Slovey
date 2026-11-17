import { dashboard, logAudit } from "@company-brain/core";
import { assertRepoAccessWithRole, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok, readJsonBody } from "@/lib/server/respond";
import { MAX_SEATS, PLANS, isPaidPlan } from "@company-brain/core/plans";
import { type BillingInterval, appBaseUrl, getStripe, planItem } from "@/lib/server/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Start a paid-plan Checkout Session for Slovey's own checkout page (Stripe
 * Checkout Sessions with ui_mode "elements": Stripe runs the payment, the page
 * is ours). Returns the session's client secret; the browser mounts the
 * Payment Element with it. Owner/admin only.
 *
 * Plan changes still happen only in the signature-verified webhook on
 * checkout.session.completed (payment_status === "paid"), exactly as before.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const body = await readJsonBody<{ plan?: string; interval?: string; seats?: number }>(req, 10_000);
    // Older clients sent no plan: they were buying the per-seat "pro" plan.
    const plan = body.plan ?? "pro";
    if (!isPaidPlan(plan)) throw new HttpError(400, "Pick Pro, Team, Business or Scale");
    const interval: BillingInterval = body.interval === "monthly" ? "monthly" : "annual";
    const perSeat = PLANS[plan].billing === "seat";
    const seatsRaw = perSeat ? Number(body.seats ?? 1) : 1;
    if (!Number.isInteger(seatsRaw) || seatsRaw < 1 || seatsRaw > MAX_SEATS) {
      throw new HttpError(400, `Seats must be a whole number from 1 to ${MAX_SEATS}`);
    }
    const { id } = await ctx.params;
    const { role } = await assertRepoAccessWithRole(id, viewer);
    if (role !== "owner" && role !== "admin") throw new HttpError(403, "Only owners or admins can change the plan");

    const org = await dashboard.getOrgForRepo(id);
    if (!org) throw new HttpError(404, "No organization for this repo");
    const stripeState = await dashboard.getOrgStripe(org.id);
    if (stripeState && stripeState.plan !== "free") {
      throw new HttpError(400, "This workspace is already on a paid plan. Use Manage billing.");
    }

    const stripe = getStripe();
    let customerId = stripeState?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        // Only a verified email (see getViewer) is ever attached.
        email: viewer.email,
        metadata: { orgId: org.id, requestedBy: viewer.login },
      });
      customerId = customer.id;
      await dashboard.setOrgStripe(org.id, { stripeCustomerId: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      ui_mode: "elements",
      mode: "subscription",
      customer: customerId,
      // Explicit: the account has cards available but no defaults activated yet,
      // and without this Stripe rejects the session outright.
      payment_method_types: ["card"],
      line_items: [await planItem(plan, interval, seatsRaw)],
      return_url: `${appBaseUrl()}/checkout/complete?session_id={CHECKOUT_SESSION_ID}`,
      // The webhook reads `plan` back from here to know which plan was paid for.
      metadata: { orgId: org.id, plan },
      subscription_data: { metadata: { orgId: org.id, plan } },
    });
    await logAudit({
      orgId: org.id,
      action: "billing.checkout_started",
      actorUser: viewer.login,
      metadata: { plan, interval, seats: seatsRaw },
    });
    if (!session.client_secret) throw new HttpError(502, "Stripe did not return a checkout session");
    return ok({ clientSecret: session.client_secret, sessionId: session.id });
  });
}
