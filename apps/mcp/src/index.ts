import { loadEnv } from "@company-brain/config";
import { decisionApi, logger, resolveRepo } from "@company-brain/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ConfigError, parseRepoSlug } from "./repo";

/**
 * Company Brain MCP server — the knowledge layer coding agents (Cursor, Claude
 * Code, …) call BEFORE generating code. Every tool reads the Engineering
 * Decision Graph through the Decision API; nothing bypasses it.
 *
 * Scope: COMPANY_BRAIN_REPO=owner/name. The server serves exactly one repo's
 * decisions — there is no silent default, so a misconfigured client cannot read
 * the wrong organization's knowledge. Stdout is the JSON-RPC channel; all logs
 * go to stderr.
 */

const VERSION = "0.1.0";

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
const errorText = (s: string) => ({ content: [{ type: "text" as const, text: s }], isError: true as const });

// Resolved once at startup, then reused.
let REPO_ID = "";
let REPO_SLUG = "";

/**
 * Wrap a tool handler so a runtime failure (DB down, transient error) becomes a
 * clean tool error the agent can read — never an unhandled crash of the server.
 */
function safe<A>(name: string, fn: (args: A) => Promise<{ content: { type: "text"; text: string }[] }>) {
  return async (args: A) => {
    try {
      return await fn(args);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`MCP tool "${name}" failed`, { error: msg });
      return errorText(`Company Brain could not complete "${name}": ${msg}`);
    }
  };
}

function registerTools(server: McpServer) {
  // The pre-code tool: what decisions govern the code about to be written.
  server.registerTool(
    "what_applies_here",
    {
      title: "What applies here",
      description:
        "Given the files/services/domains a change touches, return the active team decisions (constraints) that govern it, with evidence. Call this BEFORE writing code.",
      inputSchema: {
        paths: z.array(z.string()).optional(),
        services: z.array(z.string()).optional(),
        domains: z.array(z.string()).optional(),
        languages: z.array(z.string()).optional(),
        frameworks: z.array(z.string()).optional(),
      },
    },
    safe("what_applies_here", async (scope) => {
      const ctx = await decisionApi.whatAppliesHere(REPO_ID, scope);
      return text(ctx.constraints.length ? ctx.promptBlock : "No recorded decisions govern this area yet.");
    }),
  );

  // Pre-code planning: an evidence-backed implementation plan that respects
  // recorded decisions. The "think before you code" entry point for agents.
  server.registerTool(
    "plan",
    {
      title: "Plan before coding",
      description:
        "Produce an evidence-backed implementation plan for an engineering request, respecting the team's recorded decisions. Returns intent, verdict (allowed/disallowed), risk, conflicts (blockers), active constraints, rejected precedent, and a step-by-step plan. Call this BEFORE starting non-trivial work.",
      inputSchema: { request: z.string() },
    },
    safe("plan", async ({ request }: { request: string }) => {
      const p = await decisionApi.plan(REPO_ID, request);
      const steps = p.steps.map((s, i) => `  ${i + 1}. ${s.title} — ${s.detail}`).join("\n");
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

  // The guardrail: is this intent allowed by recorded decisions?
  server.registerTool(
    "can_i",
    {
      title: "Can I",
      description:
        "Check whether an intended change is allowed by recorded team decisions. Returns allowed/disallowed/unclear with cited reasoning and any rejected precedent ('we already tried this').",
      inputSchema: { intent: z.string() },
    },
    safe("can_i", async ({ intent }: { intent: string }) => {
      const r = await decisionApi.canI(REPO_ID, intent);
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

  // Natural-language Q&A over the decision graph (cited; declines without evidence).
  server.registerTool(
    "ask",
    {
      title: "Ask the engineering brain",
      description:
        "Ask a question about the team's engineering decisions (e.g. 'why don't we use Redis?', 'who owns auth?'). Answers are grounded in recorded decisions with citations, or decline if none exist.",
      inputSchema: { question: z.string() },
    },
    safe("ask", async ({ question }: { question: string }) => {
      const a = await decisionApi.ask(REPO_ID, question);
      const cites = a.citations.map((c) => `  - ${c.decision} [${c.evidence.join(", ")}]`).join("\n");
      return text(`${a.answer}\n(confidence: ${a.confidence})` + (cites ? `\n\nsources:\n${cites}` : ""));
    }),
  );

  // Negative knowledge: what the team has already rejected.
  server.registerTool(
    "get_rejected",
    {
      title: "Get rejected approaches",
      description:
        "List approaches the team has explicitly rejected (optionally filtered by a query). Use to avoid re-proposing something that was already tried and turned down.",
      inputSchema: { query: z.string().optional() },
    },
    safe("get_rejected", async ({ query }: { query?: string }) => {
      const rows = await decisionApi.getRejectedKnowledge(REPO_ID, query);
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
}

/** Fail fast with an actionable message; never start half-configured. */
function fatal(message: string): never {
  process.stderr.write(`\n[company-brain mcp] ${message}\n\n`);
  process.exit(1);
}

async function main() {
  // 1. Environment (DATABASE_URL etc.) — loadEnv throws a readable list.
  try {
    loadEnv();
  } catch (e) {
    fatal(e instanceof Error ? e.message : String(e));
  }

  // 2. Scope — required, validated, no silent default.
  let slug: ReturnType<typeof parseRepoSlug>;
  try {
    slug = parseRepoSlug(process.env.COMPANY_BRAIN_REPO);
  } catch (e) {
    if (e instanceof ConfigError) fatal(e.message);
    throw e;
  }
  REPO_SLUG = slug.slug;

  // 3. Resolve the repo NOW so misconfiguration fails at startup, not mid-tool.
  let resolved: Awaited<ReturnType<typeof resolveRepo>>;
  try {
    resolved = await resolveRepo(slug.slug);
  } catch (e) {
    fatal(`Could not reach the database to resolve "${slug.slug}": ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!resolved) {
    fatal(
      `Repository "${slug.slug}" is not connected to Company Brain. Install the GitHub App on it (or check COMPANY_BRAIN_REPO).`,
    );
  }
  REPO_ID = resolved.repoId;

  // 4. Register tools + connect over stdio.
  const server = new McpServer({ name: "company-brain", version: VERSION });
  registerTools(server);
  await server.connect(new StdioServerTransport());
  // Stderr only — stdout is the JSON-RPC channel.
  process.stderr.write(`[company-brain mcp] ready · repo ${REPO_SLUG} · v${VERSION}\n`);
}

main().catch((e) => {
  process.stderr.write(`[company-brain mcp] fatal: ${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exit(1);
});
