import { dashboard, logAudit } from "@company-brain/core";
import { requireSuperAdmin } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLANS = new Set(["free", "pro", "enterprise"]);

/**
 * Set any org's plan, including enterprise. This is the out-of-band admin path
 * the repo-scoped billing PATCH points to — gated on super-admin, not org role.
 * No payment processing: comped upgrades and sales-led enterprise deals.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireSuperAdmin();
    const { id } = await ctx.params;
    const body = (await req.json()) as { plan?: string };
    if (!body.plan || !PLANS.has(body.plan)) throw new HttpError(400, "invalid plan");
    await dashboard.setOrgPlan(id, body.plan as dashboard.OrgPlan);
    await logAudit({
      orgId: id,
      action: "billing.plan_changed",
      actorUser: viewer.login,
      metadata: { plan: body.plan, via: "admin-console" },
    });
    return ok({ id, plan: body.plan });
  });
}
