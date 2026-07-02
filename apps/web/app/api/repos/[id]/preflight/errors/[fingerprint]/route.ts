import { preflight } from "@company-brain/core";
import { assertRepoAccess, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Explain one stored error by fingerprint (the `id` on fixInstructions). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; fingerprint: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id, fingerprint } = await ctx.params;
    await assertRepoAccess(id, viewer);
    const found = await preflight.findErrorByFingerprint(id, fingerprint);
    if (!found) throw new HttpError(404, "No stored error with that fingerprint");
    return ok(found);
  });
}
