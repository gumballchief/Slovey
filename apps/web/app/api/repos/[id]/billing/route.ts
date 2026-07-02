import { dashboard, logAudit } from "@company-brain/core";
import { assertRepoAccessWithRole, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";
import { isBillingConfigured } from "@/lib/server/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLANS = new Set(["free", "pro", "enterprise"]);

/** Current plan + real usage for the repo's org. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoAccessWithRole(id, viewer);
    const org = await dashboard.getOrgForRepo(id);
    if (!org) throw new HttpError(404, "No organization for this repo");
    return ok({ org: { id: org.id, name: org.name }, ...(await dashboard.getBilling(org.id)) });
  });
}

/** Change the org plan. No payment processing — a manual switch; owner/admin only. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    const { role, repo } = await assertRepoAccessWithRole(id, viewer);
    if (role !== "owner" && role !== "admin") {
      throw new HttpError(403, "Only owners or admins can change the plan");
    }
    const body = (await req.json()) as { plan?: string };
    if (!body.plan || !PLANS.has(body.plan)) throw new HttpError(400, "invalid plan");
    // With Stripe live, paid plans go through Checkout — the manual switch would
    // grant Pro without payment. Downgrades/enterprise (sales-led) stay manual.
    if (isBillingConfigured() && body.plan === "pro") {
      throw new HttpError(400, "Upgrade to Pro via checkout (POST billing/checkout)");
    }

    const org = await dashboard.getOrgForRepo(id);
    if (!org) throw new HttpError(404, "No organization for this repo");
    await dashboard.setOrgPlan(org.id, body.plan as dashboard.OrgPlan);
    await logAudit({
      orgId: org.id,
      repoId: repo.repoId,
      action: "billing.plan_changed",
      actorUser: viewer.login,
      metadata: { plan: body.plan },
    });
    return ok({ ...(await dashboard.getBilling(org.id)) });
  });
}
