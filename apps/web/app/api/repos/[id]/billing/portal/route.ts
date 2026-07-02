import { dashboard } from "@company-brain/core";
import { assertRepoAccessWithRole, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";
import { appBaseUrl, getStripe } from "@/lib/server/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stripe customer portal (invoices, card, cancel). Owner/admin only. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    const { role } = await assertRepoAccessWithRole(id, viewer);
    if (role !== "owner" && role !== "admin") throw new HttpError(403, "Only owners or admins can manage billing");

    const org = await dashboard.getOrgForRepo(id);
    if (!org) throw new HttpError(404, "No organization for this repo");
    const stripeState = await dashboard.getOrgStripe(org.id);
    if (!stripeState?.stripeCustomerId) throw new HttpError(400, "No billing account yet — upgrade first");

    const session = await getStripe().billingPortal.sessions.create({
      customer: stripeState.stripeCustomerId,
      return_url: `${appBaseUrl()}/app/billing`,
    });
    return ok({ url: session.url });
  });
}
