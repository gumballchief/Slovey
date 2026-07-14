import { importDocs, splitDocs, logAudit, planGuard, type ImportDoc } from "@company-brain/core";
import { assertRepoWrite, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok, readJsonBody } from "@/lib/server/respond";
import { rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Seed the decision graph from existing docs (ADRs / RFCs / architecture
 * markdown). Body: { text } (split on `# ` headings) or { docs: [{path,content}] }.
 * Extracted decisions land as `proposed` → the review queue. Write-gated + audited.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoWrite(id, viewer);
    rateLimit(`import:${viewer.userId ?? viewer.login}`, 10, 60_000);

    // ~2MB cap: importDocs then bounds to 30 docs × 16K chars.
    const body = await readJsonBody<{ text?: string; docs?: ImportDoc[] }>(req, 2_000_000);
    const docs: ImportDoc[] = body.docs?.length
      ? body.docs
      : body.text?.trim()
        ? splitDocs(body.text)
        : [];
    if (docs.length === 0) throw new HttpError(400, "provide `text` or `docs`");

    const headroom = await planGuard.decisionHeadroom(id);
    if (!headroom.ok) {
      throw new HttpError(402, `The ${headroom.plan} plan is capped at ${headroom.limit} decisions (you have ${headroom.used}). Upgrade to import more.`);
    }

    // The pre-check above only guaranteed room for ONE decision, but a multi-doc
    // import upserts many at once — without a cap a free org at 199/200 could
    // import 30 docs and blow past the 200 limit. Bound the import to the org's
    // remaining headroom (undefined = unlimited plan).
    const maxNew = headroom.limit < 0 ? undefined : Math.max(0, headroom.limit - headroom.used);
    const result = await importDocs(id, docs, maxNew);
    await logAudit({
      repoId: id,
      actorUser: viewer.login,
      action: "import.docs",
      targetType: "repo",
      targetId: id,
      metadata: { docs: result.docs, extracted: result.extracted },
    });
    return ok(result);
  });
}
