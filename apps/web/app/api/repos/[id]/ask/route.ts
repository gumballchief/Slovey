import { reasoning } from "@company-brain/core";
import { assertRepoAccess, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";
import { rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Engineering Search — ask the decision graph a question ("why don't we use
 * Redis?") and get a reasoned, cited answer (or an honest "no recorded decision").
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoAccess(id, viewer);
    rateLimit(`ask:${viewer.userId ?? viewer.login}`, 30, 60_000);
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    if (!q) throw new HttpError(400, "q is required");
    return ok(await reasoning.engineeringSearch(id, q));
  });
}
