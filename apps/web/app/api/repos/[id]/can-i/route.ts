import { decisionApi } from "@company-brain/core";
import { assertRepoAccess, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";
import { rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CanI — pre-code guardrail. POST { intent } → allowed/disallowed/unclear +
 * cited decisions + rejected precedent ("we already tried this").
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoAccess(id, viewer);
    rateLimit(`cani:${viewer.userId ?? viewer.login}`, 30, 60_000);
    const body = (await req.json().catch(() => ({}))) as { intent?: string };
    if (!body.intent?.trim()) throw new HttpError(400, "intent is required");
    return ok(await decisionApi.canI(id, body.intent.trim()));
  });
}
