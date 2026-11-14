import { dashboard } from "@company-brain/core";
import { assertRepoAccess, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";
import { getStripe } from "@/lib/server/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Status of one checkout, for the page Stripe returns to after payment. Read
 * only; it never changes the plan (the webhook does that). The session must
 * belong to this repo's organization.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoAccess(id, viewer);
    const sessionId = new URL(req.url).searchParams.get("session_id") ?? "";
    if (!/^cs_[A-Za-z0-9_]{8,200}$/.test(sessionId)) throw new HttpError(400, "Invalid session id");

    const org = await dashboard.getOrgForRepo(id);
    if (!org) throw new HttpError(404, "No organization for this repo");
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.metadata?.orgId !== org.id) throw new HttpError(404, "Checkout not found");

    const stripeState = await dashboard.getOrgStripe(org.id);
    return ok({
      status: session.status, // open | complete | expired
      paymentStatus: session.payment_status, // paid | unpaid | no_payment_required
      amountTotal: session.amount_total,
      currency: session.currency,
      plan: stripeState?.plan ?? "free",
    });
  });
}
