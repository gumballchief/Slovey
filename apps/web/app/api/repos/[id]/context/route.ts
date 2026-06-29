import { reasoning } from "@company-brain/core";
import { assertRepoAccess, requireViewer } from "@/lib/server/auth";
import { handle, ok } from "@/lib/server/respond";

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
    const body = (await req.json().catch(() => ({}))) as {
      paths?: string[];
      directories?: string[];
      services?: string[];
      domains?: string[];
      languages?: string[];
      frameworks?: string[];
    };
    return ok(await reasoning.contextForScope(id, body));
  });
}
