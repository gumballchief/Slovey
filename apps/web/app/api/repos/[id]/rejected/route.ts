import { decisionApi } from "@company-brain/core";
import { assertRepoAccess, requireViewer } from "@/lib/server/auth";
import { handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rejected knowledge — "we already tried this". Optional ?q= for semantic filter. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoAccess(id, viewer);
    const q = new URL(req.url).searchParams.get("q") ?? undefined;
    return ok(await decisionApi.getRejectedKnowledge(id, q));
  });
}
