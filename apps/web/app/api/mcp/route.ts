import { decisionApi, preflight } from "@company-brain/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { type CliCaller, authorizeCliToken } from "@/lib/server/cli-auth";
import { publicOrigin } from "@/lib/server/oauth";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";
import { HttpError } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Slovey's hosted MCP server (Streamable HTTP, stateless, JSON responses).
 *
 * Agents connect with a URL and nothing to install. Without a key they get a 401
 * pointing at Slovey's OAuth metadata, so claude.ai, Claude Desktop and Claude Code
 * run "Sign in with Slovey" by themselves; with a key made on the Connect page:
 *   claude mcp add --transport http slovey https://slovey.ai/api/mcp --header "Authorization: Bearer cb_…"
 *
 * Every tool reads the one repository the key was issued for. The installable
 * `slovey-mcp` server offers the same memory tools plus local Preflight; this one
 * replaces local Preflight with check_change, which takes the diff itself.
 */

const VERSION = "1.0.0";
const MAX_BODY_BYTES = 3_000_000; // a diff for check_change can be large; same ceiling as the CLI route
const shortText = z.string().trim().min(1).max(4000);
const list = z.array(z.string().max(500)).max(100).optional();

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });

function safe<A>(name: string, fn: (args: A) => Promise<ReturnType<typeof text>>) {
  return async (args: A) => {
    try {
      return await fn(args);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ...text(`Slovey could not complete "${name}": ${msg}`), isError: true as const };
    }
  };
}

function buildServer({ repoId, repoFullName }: CliCaller, origin: string): McpServer {
  const server = new McpServer(
    {
      name: "slovey",
      title: "Slovey",
      version: VERSION,
      websiteUrl: origin,
      // Clients that show server icons use these; claude.ai custom connectors use the site favicon.
      icons: [
        { src: `${origin}/icon.png`, mimeType: "image/png", sizes: ["512x512"] },
        { src: `${origin}/favicon.ico`, mimeType: "image/x-icon", sizes: ["16x16", "32x32", "48x48"] },
      ],
    },
    {
      instructions:
        `Slovey is the memory of ${repoFullName}: the decisions its team made, learned from merged and rejected pull requests and docs. ` +
        "Before writing code, call what_applies_here (or plan for bigger work) and follow the constraints it returns. " +
        "Use can_i when unsure whether an approach is allowed, and get_rejected to avoid re-proposing something the team turned down. " +
        "Before committing, call check_change with your diff and fix anything it blocks.",
    },
  );

  server.registerTool(
    "what_applies_here",
    {
      title: "What applies here",
      description:
        "Given the files, services or domains a change touches, return the team decisions that govern it, with evidence. Call this BEFORE writing code.",
      inputSchema: { paths: list, services: list, domains: list, languages: list, frameworks: list },
    },
    safe("what_applies_here", async (scope) => {
      const ctx = await decisionApi.whatAppliesHere(repoId, scope);
      return text(ctx.constraints.length ? ctx.promptBlock : "No recorded decisions govern this area yet.");
    }),
  );

  server.registerTool(
    "plan",
    {
      title: "Plan before coding",
      description:
        "Produce an implementation plan for an engineering request that respects the team's decisions: verdict, risk, blockers, constraints and steps. Call this BEFORE starting non-trivial work.",
      inputSchema: { request: shortText },
    },
    safe("plan", async ({ request }) => {
      const p = await decisionApi.plan(repoId, request);
      const steps = p.steps.map((s, i) => `  ${i + 1}. ${s.title}: ${s.detail}`).join("\n");
      const constraints = p.constraints.map((c) => `  - ${c.decision}`).join("\n");
      const conflicts = p.conflicts.map((c) => `  ! ${c}`).join("\n");
      return text(
        `intent: ${p.intent} | verdict: ${p.verdict.toUpperCase()} | risk: ${p.risk} | confidence: ${p.confidence}\n\n${p.summary}` +
          (conflicts ? `\n\nblockers:\n${conflicts}` : "") +
          (steps ? `\n\nplan:\n${steps}` : "") +
          (constraints ? `\n\nactive constraints:\n${constraints}` : ""),
      );
    }),
  );

  server.registerTool(
    "can_i",
    {
      title: "Can I",
      description:
        "Check whether an intended change is allowed by the team's decisions. Returns allowed, disallowed or unclear with cited reasons and any approach the team already rejected.",
      inputSchema: { intent: shortText },
    },
    safe("can_i", async ({ intent }) => {
      const r = await decisionApi.canI(repoId, intent);
      const cites = r.citations.map((c) => `  - ${c.decision} [${c.evidence.join(", ")}]`).join("\n");
      const rej = r.rejectedPrecedent
        .map((p) => `  - REJECTED: ${p.decision}${p.rejectionReason ? ` (${p.rejectionReason})` : ""}`)
        .join("\n");
      return text(
        `verdict: ${r.verdict.toUpperCase()}\n${r.rationale}` +
          (cites ? `\n\nbased on:\n${cites}` : "") +
          (rej ? `\n\nrejected precedent:\n${rej}` : ""),
      );
    }),
  );

  server.registerTool(
    "ask",
    {
      title: "Ask the team's memory",
      description:
        "Ask about the team's engineering decisions (for example 'why don't we use Redis?'). Answers cite the decisions and pull requests behind them, or say so when nothing is recorded.",
      inputSchema: { question: shortText },
    },
    safe("ask", async ({ question }) => {
      const a = await decisionApi.ask(repoId, question);
      const cites = a.citations.map((c) => `  - ${c.decision} [${c.evidence.join(", ")}]`).join("\n");
      return text(`${a.answer}\n(confidence: ${a.confidence})` + (cites ? `\n\nsources:\n${cites}` : ""));
    }),
  );

  server.registerTool(
    "get_rejected",
    {
      title: "Get rejected approaches",
      description:
        "List approaches the team explicitly rejected, optionally filtered by a query, so you don't propose them again.",
      inputSchema: { query: z.string().trim().max(4000).optional() },
    },
    safe("get_rejected", async ({ query }) => {
      const rows = await decisionApi.getRejectedKnowledge(repoId, query || undefined, 25);
      if (rows.length === 0) return text("No rejected approaches recorded for this query.");
      return text(
        rows
          .map(
            (r) =>
              `- ${r.decision}${r.rejectionReason ? `\n    why: ${r.rejectionReason}` : ""}${r.alternatives.length ? `\n    instead: ${r.alternatives.join(", ")}` : ""}`,
          )
          .join("\n"),
      );
    }),
  );

  server.registerTool(
    "check_change",
    {
      title: "Check a change before committing",
      description:
        "Send the unified diff of your change (and the paths it touches). Slovey checks it against the team's decisions and returns whether it is safe to commit, plus exact fix instructions for anything it blocks. Call this BEFORE committing.",
      inputSchema: {
        diff: z.string().min(1),
        changed_files: z.array(z.string().max(1000)).max(2000).optional(),
      },
    },
    safe("check_change", async ({ diff, changed_files }) => {
      const r = await preflight.runRemotePreflight(repoId, { diff, changedFiles: changed_files });
      const violations = r.decisionViolations
        .map((v) => `  ! ${v.title}: ${v.violation}\n    fix: ${v.instructionForAgent}`)
        .join("\n");
      // A decision check that could not run is never reported as "safe".
      const unverified = r.checks.some((c) => c.name === "decision-check" && c.status === "skipped");
      const head = !r.safeToCommit ? `BLOCKED (${r.status})` : unverified ? "NOT VERIFIED" : `SAFE TO COMMIT (${r.status})`;
      const warnings = r.warnings.map((w) => `  - ${w}`).join("\n");
      return text(
        `${head}\n${r.summary}` +
          (violations ? `\n\ndecisions this breaks:\n${violations}` : "") +
          (warnings ? `\n\nwarnings:\n${warnings}` : "") +
          (r.agentInstruction ? `\n\nnext: ${r.agentInstruction}` : ""),
      );
    }),
  );

  return server;
}

function rpcError(status: number, message: string, headers?: HeadersInit): Response {
  return Response.json({ jsonrpc: "2.0", error: { code: -32001, message }, id: null }, { status, headers });
}

export async function POST(req: Request): Promise<Response> {
  try {
    rateLimit(`mcp:${clientIp(req)}`, 240, 60_000);
  } catch {
    return rpcError(429, "Rate limited. Slow down and retry shortly.");
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return rpcError(413, "Request too large. Send only the diff of the change.");
  }

  let caller: CliCaller;
  try {
    caller = await authorizeCliToken(req);
  } catch (e) {
    if (e instanceof HttpError) {
      // RFC 9728: a 401 names the resource metadata, which names the sign-in server.
      const challenge = `Bearer realm="slovey", resource_metadata="${publicOrigin(req)}/.well-known/oauth-protected-resource/api/mcp"`;
      return rpcError(e.status, e.message, e.status === 401 ? { "WWW-Authenticate": challenge } : undefined);
    }
    console.error("[api] mcp auth error:", e);
    return rpcError(500, "Internal error");
  }

  const server = buildServer(caller, publicOrigin(req));
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  try {
    await server.connect(transport);
    return await transport.handleRequest(req);
  } catch (e) {
    console.error("[api] mcp error:", e);
    return rpcError(500, "Internal error");
  } finally {
    void server.close();
  }
}

/** Stateless server: there is no event stream to open and no session to end. */
function methodNotAllowed(): Response {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
