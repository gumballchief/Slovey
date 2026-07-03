import { dashboard, logAudit } from "@company-brain/core";
import { assertRepoAccess, assertRepoWrite, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoAccess(id, viewer);
    const url = new URL(req.url);
    return ok(
      await dashboard.listDecisions(id, {
        query: url.searchParams.get("q") ?? undefined,
        source: url.searchParams.get("source") ?? undefined,
      }),
    );
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoWrite(id, viewer);
    const body = (await req.json()) as {
      decision?: string;
      why?: string;
      examples?: string[];
      evidence?: string[];
      source?: "github_pr" | "doc" | "linear" | "notion" | "slack" | "repo_analysis" | "manual";
      category?: string;
      status?: string;
      rejectionReason?: string;
      alternatives?: string[];
    };
    if (!body.decision?.trim()) throw new HttpError(400, "decision is required");
    if (body.status && body.status !== "approved" && body.status !== "rejected") {
      throw new HttpError(400, 'status must be "approved" or "rejected"');
    }
    const created = await dashboard.createDecision(id, {
      decision: body.decision,
      why: body.why,
      examples: body.examples ?? [],
      evidence: body.evidence ?? [],
      source: body.source,
      category: body.category,
      status: body.status as "approved" | "rejected" | undefined,
      rejectionReason: body.rejectionReason,
      alternatives: body.alternatives ?? [],
      createdBy: viewer.login,
    });
    await logAudit({ repoId: id, actorUser: viewer.login, action: "decision.create", targetType: "decision", targetId: created.id });
    return ok(created, { status: 201 });
  });
}
