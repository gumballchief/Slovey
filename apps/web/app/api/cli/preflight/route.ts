import { preflight, resolveRepoById, verifyApiToken } from "@company-brain/core";
import { HttpError, handle, ok } from "@/lib/server/respond";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Token-authenticated preflight for the CLI / CI — no browser session, no direct
 * DB connection on the client. Authenticates a repo-scoped `cb_…` token, then
 * runs the server-side knowledge checks (decision graph, architecture rules
 * derived from rejected decisions, secret scan, AI security review) against the
 * caller-supplied diff/files. Command checks (typecheck/test/build) still run on
 * the developer machine and are reported here as skipped-with-reason.
 */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    try {
      rateLimit(`cli-preflight:${clientIp(req)}`, 120, 60_000);
    } catch {
      throw new HttpError(429, "Rate limited — slow down and retry shortly.");
    }

    const auth = req.headers.get("authorization") ?? "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
    const verified = await verifyApiToken(token);
    if (!verified) {
      throw new HttpError(401, "Invalid or missing API token. Create one in the dashboard and set COMPANY_BRAIN_TOKEN.");
    }

    // The token is repo-scoped; confirm the repo still exists (guards against a
    // deleted/re-synced repo behind a stale token).
    const repo = await resolveRepoById(verified.repoId);
    if (!repo) throw new HttpError(404, "The repository this token was issued for no longer exists.");

    const body = (await req.json().catch(() => ({}))) as {
      diff?: string;
      changedFiles?: string[];
      files?: { path: string; content: string }[];
      branch?: string | null;
      commitSha?: string | null;
      attemptId?: string | null;
    };

    // Guard against oversized payloads (whole-repo dumps) — by byte size AND by
    // file cardinality (a huge changedFiles array is cheap to send, costly to process).
    const totalBytes = (body.files ?? []).reduce((n, f) => n + (f.content?.length ?? 0), 0) + (body.diff?.length ?? 0);
    if (totalBytes > 2_000_000) {
      throw new HttpError(413, "Payload too large — send only changed files/diff (max ~2MB).");
    }
    if ((body.changedFiles?.length ?? 0) > 2000 || (body.files?.length ?? 0) > 2000) {
      throw new HttpError(413, "Too many changed files — send only the files this change touches (max 2000).");
    }

    const result = await preflight.runRemotePreflight(verified.repoId, {
      diff: body.diff,
      changedFiles: body.changedFiles,
      files: body.files,
      branch: body.branch,
      commitSha: body.commitSha,
      attemptId: body.attemptId,
    });

    return ok({ repo: repo.fullName, result });
  });
}
