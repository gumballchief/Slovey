import { dashboard } from "@company-brain/core";
import { requireViewer } from "@/lib/server/auth";
import { handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Repos the viewer can see — scoped to what they own or belong to (never all tenants'). */
export async function GET(): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    // Dev/local (no Supabase) sees everything; real viewers are scoped to their
    // owned repos + org memberships so one tenant never sees another's repos.
    if (viewer.isDev) return ok(await dashboard.listRepos());
    const orgIds = viewer.userId ? await dashboard.listUserOrgIds(viewer.userId) : [];
    return ok(await dashboard.listRepos({ githubId: viewer.githubId, login: viewer.login, orgIds }));
  });
}
