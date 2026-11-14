import { decisionApi } from "@company-brain/core";
import { assertRepoAccess, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok, readJsonBody } from "@/lib/server/respond";
import { rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Planning Engine — pre-code implementation planning. POST { request } →
 * intent, scope, verdict, risk, evidence-backed summary + steps, constraints,
 * rejected precedent and conflicts. Routes entirely through the Decision API.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoAccess(id, viewer);
    rateLimit(`plan:${viewer.userId ?? viewer.login}`, 20, 60_000);
    const body = (await readJsonBody(req)) as { request?: string };
    const request = body.request?.trim();
    if (!request) throw new HttpError(400, "request is required");
    if (request.length > 20_000) throw new HttpError(413, "request is too long (max 20000 characters).");
    return ok(await decisionApi.plan(id, request));
  });
}
