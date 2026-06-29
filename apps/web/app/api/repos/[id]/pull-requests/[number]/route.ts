import { dashboard } from "@company-brain/core";
import { assertRepoAccess, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; number: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id, number } = await ctx.params;
    await assertRepoAccess(id, viewer);
    const prNumber = Number(number);
    if (!Number.isInteger(prNumber)) throw new HttpError(400, "invalid PR number");
    const detail = await dashboard.getPRCheck(id, prNumber);
    if (!detail) throw new HttpError(404, "PR check not found");
    return ok(detail);
  });
}
