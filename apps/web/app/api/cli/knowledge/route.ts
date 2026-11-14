import { decisionApi } from "@company-brain/core";
import { authorizeCliToken } from "@/lib/server/cli-auth";
import { HttpError, handle, ok, readJsonBody } from "@/lib/server/respond";
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
      paths: arr(a.paths, "paths"),
      services: arr(a.services, "services"),
      domains: arr(a.domains, "domains"),
      languages: arr(a.languages, "languages"),
      frameworks: arr(a.frameworks, "frameworks"),
    }),
  can_i: (repoId: string, a: Args) => decisionApi.canI(repoId, req(a.intent, "intent")),
  ask: (repoId: string, a: Args) => decisionApi.ask(repoId, req(a.question, "question")),
  plan: (repoId: string, a: Args) => decisionApi.plan(repoId, req(a.request, "request")),
  rejected: (repoId: string, a: Args) => {
    const q = a.query?.trim() || undefined;
    if (q && q.length > 4000) throw new HttpError(413, `"query" is too long (max 4000 characters).`);
    return decisionApi.getRejectedKnowledge(repoId, q, clampLimit(a.limit));
  },
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

/** An optional string array, capped so a huge filter set can't exhaust the DB. */
function arr(value: unknown, name: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new HttpError(400, `"${name}" must be an array.`);
  if (value.length > 100) throw new HttpError(413, `"${name}" has too many items (max 100).`);
  return value.map((v) => {
    if (typeof v !== "string") throw new HttpError(400, `"${name}" must be an array of strings.`);
    const trimmed = v.trim();
    if (trimmed.length > 500) throw new HttpError(413, `"${name}" item is too long (max 500 characters).`);
    return trimmed;
  });
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

    const caller = await authorizeCliToken(req_);

    const body = await readJsonBody<{ op?: string; args?: Args }>(req_, 1_000_000);
    const op = body.op as OpName | undefined;
    if (!op || !(op in OPS)) {
      throw new HttpError(400, `Unknown operation. Expected one of: ${Object.keys(OPS).join(", ")}.`);
    }

    const result = await OPS[op](caller.repoId, body.args ?? {});
    return ok({ repo: caller.repoFullName, op, result });
  });
}
