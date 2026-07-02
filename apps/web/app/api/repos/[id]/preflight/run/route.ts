import { preflight } from "@company-brain/core";
import { assertRepoWrite, requireViewer } from "@/lib/server/auth";
import { HttpError, handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILES = 50;
const MAX_FILE_BYTES = 200_000;
const MAX_DIFF_BYTES = 200_000;

/**
 * Server-side Preflight: runs the knowledge checks (decision-graph, architecture
 * rules incl. derived-from-rejected, secret scan) against a supplied diff/file
 * payload. Command checks (typecheck/test/build) need the local workspace and are
 * reported as skipped — this endpoint complements, never replaces, the local gate.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoWrite(id, viewer);
    const body = (await req.json().catch(() => null)) as preflight.RemotePreflightPayload | null;
    if (!body || (!body.diff && !body.files?.length && !body.changedFiles?.length)) {
      throw new HttpError(400, "Provide at least one of: diff, files[{path,content}], changedFiles[]");
    }
    if ((body.files?.length ?? 0) > MAX_FILES) throw new HttpError(400, `Too many files (max ${MAX_FILES})`);
    if (body.files?.some((f) => !f.path || typeof f.content !== "string" || f.content.length > MAX_FILE_BYTES)) {
      throw new HttpError(400, `Each file needs a path and content under ${MAX_FILE_BYTES} bytes`);
    }
    if ((body.diff?.length ?? 0) > MAX_DIFF_BYTES) throw new HttpError(400, `Diff too large (max ${MAX_DIFF_BYTES} bytes)`);
    return ok(await preflight.runRemotePreflight(id, body));
  });
}
