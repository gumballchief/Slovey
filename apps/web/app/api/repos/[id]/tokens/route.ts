import { createApiToken, listApiTokens, logAudit } from "@company-brain/core";
import { assertRepoAccess, assertRepoWrite, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List the viewer's active CLI tokens for this repo (hints only, no secrets). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoAccess(id, viewer);
    if (!viewer.userId) return ok([]);
    return ok(await listApiTokens(viewer.userId, id));
  });
}

/** Mint a repo-scoped CLI token. Returns the plaintext ONCE — it's never retrievable again. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoWrite(id, viewer);
    if (!viewer.userId) {
      throw new HttpError(403, "Sign in with GitHub to create a CLI token (tokens are tied to your GitHub identity).");
    }
    const body = (await req.json().catch(() => ({}))) as { name?: string; days?: number };
    const name = (body.name ?? "cli").slice(0, 60);
    const expiresAt =
      typeof body.days === "number" && body.days > 0
        ? new Date(Date.now() + body.days * 86_400_000)
        : null;

    const created = await createApiToken({ userId: viewer.userId, repoId: id, name, expiresAt });
    await logAudit({ repoId: id, actorUser: viewer.login, action: "token.create", targetType: "api_token", targetId: created.id });
    // `token` is the plaintext — surfaced once, then only the hint is ever shown.
    return ok(created, { status: 201 });
  });
}
