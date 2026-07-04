import { logAudit, revokeApiToken } from "@company-brain/core";
import { assertRepoWrite, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Revoke a CLI token the viewer owns. */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; tokenId: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id, tokenId } = await ctx.params;
    await assertRepoWrite(id, viewer);
    if (!viewer.userId) throw new HttpError(403, "Not permitted.");
    const revoked = await revokeApiToken(viewer.userId, tokenId);
    if (!revoked) throw new HttpError(404, "Token not found (already revoked, or not yours).");
    await logAudit({ repoId: id, actorUser: viewer.login, action: "token.revoke", targetType: "api_token", targetId: tokenId });
    return ok({ revoked: true });
  });
}
