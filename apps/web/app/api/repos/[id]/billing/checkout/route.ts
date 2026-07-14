import { dashboard, logAudit } from "@company-brain/core";
import { assertRepoAccessWithRole, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";
import { type BillingInterval, appBaseUrl, getStripe, proLineItem } from "@/lib/server/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Start a Stripe Checkout session for the Pro plan. Owner/admin only. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const body = (await req.json().catch(() => ({}))) as { interval?: string };
    const interval: BillingInterval = body.interval === "monthly" ? "monthly" : "annual";
    const { id } = await ctx.params;
    const { role } = await assertRepoAccessWithRole(id, viewer);
    if (role !== "owner" && role !== "admin") throw new HttpError(403, "Only owners or admins can change the plan");

    const org = await dashboard.getOrgForRepo(id);
    if (!org) throw new HttpError(404, "No organization for this repo");
    const stripeState = await dashboard.getOrgStripe(org.id);
    if (stripeState?.plan === "pro") throw new HttpError(400, "Already on Pro — use Manage billing");

    const stripe = getStripe();
    let customerId = stripeState?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: { orgId: org.id, requestedBy: viewer.login },
      });
      customerId = customer.id;
      await dashboard.setOrgStripe(org.id, { stripeCustomerId: customerId });
    }

    // Derive the redirect origin from the request (x-forwarded-host on Render),
    // falling back to APP_BASE_URL — so the post-payment redirect returns to the
    // real deployed domain even when APP_BASE_URL is unset (it would otherwise
    // default to localhost and bounce the user off-site after paying).
    const fwdHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    const fwdProto = req.headers.get("x-forwarded-proto") ?? "https";
    const origin = fwdHost ? `${fwdProto}://${fwdHost}` : appBaseUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      // Explicit: the account has cards available but no defaults activated yet,
      // and without this Stripe rejects the session outright.
      payment_method_types: ["card"],
      line_items: [proLineItem(interval)],
      success_url: `${origin}/app/billing?checkout=success`,
      cancel_url: `${origin}/app/billing?checkout=cancelled`,
      metadata: { orgId: org.id },
      subscription_data: { metadata: { orgId: org.id } },
    });
    await logAudit({
      orgId: org.id,
      action: "billing.checkout_started",
      actorUser: viewer.login,
      metadata: { plan: "pro", interval },
    });
    if (!session.url) throw new HttpError(502, "Stripe did not return a checkout URL");
    return ok({ url: session.url });
  });
}
