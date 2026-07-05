import { reasoning } from "@company-brain/core";
import { assertRepoAccess, requireViewer } from "@/lib/server/auth";
import { handle, ok, readJsonBody } from "@/lib/server/respond";
import { rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Engineering Context API — given where code is about to be written
 * (paths/services/domains/languages/frameworks), return the active decisions
 * that govern it, as constraints + a paste-ready prompt block. For IDEs and
 * coding agents to consult BEFORE generating code (upstream of review).
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoAccess(id, viewer);
    rateLimit(`context:${viewer.userId ?? viewer.login}`, 60, 60_000);
    const body = await readJsonBody<{
      paths?: string[];
      directories?: string[];
      services?: string[];
      domains?: string[];
      languages?: string[];
      frameworks?: string[];
    }>(req);
    return ok(await reasoning.contextForScope(id, body));
  });
}
