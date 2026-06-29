import { dashboard } from "@company-brain/core";
import { assertRepoAccessWithRole, requireViewer } from "@/lib/server/auth";
import { handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The org behind a repo: details, members + roles, recent audit log, viewer role. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    const { role } = await assertRepoAccessWithRole(id, viewer);

    const org = await dashboard.getOrgForRepo(id);
    if (!org) {
      return ok({ org: null, viewer: { login: viewer.login, role }, members: [], audit: [] });
    }
    const [members, audit] = await Promise.all([
      dashboard.listOrgMembers(org.id),
      dashboard.listAuditLog(org.id, 50),
    ]);
    return ok({ org, viewer: { login: viewer.login, role }, members, audit });
  });
}
