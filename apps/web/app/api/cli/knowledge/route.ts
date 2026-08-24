import { dashboard, decisionApi, resolveRepoById, verifyApiToken } from "@company-brain/core";
import { HttpError, handle, ok } from "@/lib/server/respond";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Token-authenticated reads of the Decision Graph, for clients that have no
 * database connection — principally the MCP server running on a developer's
 * machine against a hosted account.
 *
 * Before this existed the MCP server could only talk to Postgres directly, so
 * `npm i -g slovey` shipped an MCP binary that exited immediately with
 * "DATABASE_URL is not set" for every hosted user. This is the same repo-scoped
 * `cb_…` token the CLI already uses, and the same authorisation checks as
 * /api/cli/preflight: the token names the repo, so a client cannot read another
 * organization's decisions by asking differently.
 *
 * Read-only by construction — the operations below are the query side of the
 * Decision API. Anything that writes (review, override) stays out of here.
 */

/** The read operations MCP tools need, each dispatched with the token's repoId. */
const OPS = {
  what_applies_here: (repoId: string, a: Args) =>
    decisionApi.whatAppliesHere(repoId, {
      paths: a.paths,
      services: a.services,
      domains: a.domains,
      languages: a.languages,
      frameworks: a.frameworks,
    }),
  can_i: (repoId: string, a: Args) => decisionApi.canI(repoId, req(a.intent, "intent")),
  ask: (repoId: string, a: Args) => decisionApi.ask(repoId, req(a.question, "question")),
  plan: (repoId: string, a: Args) => decisionApi.plan(repoId, req(a.request, "request")),
  rejected: (repoId: string, a: Args) =>
    decisionApi.getRejectedKnowledge(repoId, a.query, clampLimit(a.limit)),
  search: (repoId: string, a: Args) => decisionApi.search(repoId, req(a.query, "query")),
} as const;

type OpName = keyof typeof OPS;

interface Args {
  paths?: string[];
  services?: string[];
  domains?: string[];
  languages?: string[];
  frameworks?: string[];
  intent?: string;
  question?: string;
  request?: string;
  query?: string;
  limit?: number;
}

/** A required string argument, named in the error so the caller can fix it. */
function req(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new HttpError(400, `"${name}" is required for this operation.`);
  if (trimmed.length > 4000) throw new HttpError(413, `"${name}" is too long (max 4000 characters).`);
  return trimmed;
}

function clampLimit(n: number | undefined): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 25;
  return Math.min(Math.max(Math.trunc(n), 1), 100);
}

export async function POST(req_: Request): Promise<Response> {
  return handle(async () => {
    try {
      rateLimit(`cli-knowledge:${clientIp(req_)}`, 240, 60_000);
    } catch {
      throw new HttpError(429, "Rate limited — slow down and retry shortly.");
    }

    const auth = req_.headers.get("authorization") ?? "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
    const verified = await verifyApiToken(token);
    if (!verified) {
      throw new HttpError(401, "Invalid or missing API token. Create one in the dashboard and set SLOVEY_TOKEN.");
    }

    const repo = await resolveRepoById(verified.repoId);
    if (!repo) throw new HttpError(404, "The repository this token was issued for no longer exists.");

    // Same revocation check as the preflight route: org membership is refreshed at
    // login, so a teammate removed from the org loses access on their next sign-in.
    if (repo.orgId) {
      const orgIds = await dashboard.listUserOrgIds(verified.userId);
      if (!orgIds.includes(repo.orgId)) {
        throw new HttpError(403, "Your access to this repository has been revoked.");
      }
    }

    const body = (await req_.json().catch(() => ({}))) as { op?: string; args?: Args };
    const op = body.op as OpName | undefined;
    if (!op || !(op in OPS)) {
      throw new HttpError(400, `Unknown operation. Expected one of: ${Object.keys(OPS).join(", ")}.`);
    }

    const result = await OPS[op](verified.repoId, body.args ?? {});
    return ok({ repo: repo.fullName, op, result });
  });
}
