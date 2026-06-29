import { dashboard } from "@company-brain/core";
import { assertRepoAccess, requireViewer } from "@/lib/server/auth";
import { handle, ok } from "@/lib/server/respond";
import { rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Semantic search over a repo's decisions. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoAccess(id, viewer);
    // Each search embeds the query — cap per user.
    rateLimit(`search:${viewer.userId ?? viewer.login}`, 30, 60_000);
    const q = new URL(req.url).searchParams.get("q") ?? "";
    return ok(await dashboard.searchDecisions(id, q));
  });
}
