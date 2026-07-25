import { dashboard } from "@company-brain/core";
import { requireSuperAdmin } from "@/lib/server/auth";
import { handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** All orgs + members + plan. Super-admin only. */
export async function GET(): Promise<Response> {
  return handle(async () => {
    await requireSuperAdmin();
    return ok({ orgs: await dashboard.adminListOrgs() });
  });
}
