import { dashboard } from "@company-brain/core";
import { requireViewer } from "@/lib/server/auth";
import { handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in viewer's profile + their org memberships. */
export async function GET(): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    if (!viewer.userId) {
      // Dev viewer (or a session without a linked DB user yet).
      return ok({
        login: viewer.login,
        email: null,
        avatarUrl: null,
        githubId: viewer.githubId ?? null,
        isDev: viewer.isDev,
        memberships: [],
      });
    }
    const profile = await dashboard.getUserProfile(viewer.userId);
    return ok({ ...(profile ?? { login: viewer.login, memberships: [] }), isDev: viewer.isDev });
  });
}
