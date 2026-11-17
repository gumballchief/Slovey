import { dashboard, logAudit } from "@company-brain/core";
import { assertRepoAccessWithRole, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok, readJsonBody } from "@/lib/server/respond";
import { isPaidPlan, isPlan } from "@company-brain/core/plans";
import { isBillingConfigured } from "@/lib/server/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const body = (await readJsonBody(req)) as { plan?: string };
    if (!isPlan(body.plan)) throw new HttpError(400, "invalid plan");
    // Enterprise (unlimited repos/decisions/agent-runs) is sales-led — it must
    // NEVER be self-assignable through this dashboard PATCH, or any owner/admin
    // could grant themselves the unlimited plan for free. It's set out-of-band
    // (admin/sales tooling calling setOrgPlan directly).
    if (body.plan === "enterprise") {
      throw new HttpError(403, "Enterprise plans are set up with our team — contact sales.");
    }
    // With Stripe live, every paid plan goes through Checkout: a manual switch
    // would grant it without payment. Downgrades to free stay manual.
    if (isBillingConfigured() && isPaidPlan(body.plan)) {
      throw new HttpError(400, "Paid plans start at checkout (POST billing/checkout)");
    }

    const org = await dashboard.getOrgForRepo(id);
    if (!org) throw new HttpError(404, "No organization for this repo");
    await dashboard.setOrgPlan(org.id, body.plan);
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
