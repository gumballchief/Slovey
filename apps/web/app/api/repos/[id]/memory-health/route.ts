import { decisionApi } from "@company-brain/core";
import { assertRepoAccess, requireViewer } from "@/lib/server/auth";
import { handle, ok } from "@/lib/server/respond";
import { rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Memory health — durability, freshness distribution, layer mix, near-duplicate
 * (consolidation) candidates, weak (false-memory) candidates, conflicts and
 * reinforcement state, with recommendations. Read-only.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoAccess(id, viewer);
    rateLimit(`memhealth:${viewer.userId ?? viewer.login}`, 30, 60_000);
    return ok(await decisionApi.memoryHealth(id));
  });
}
