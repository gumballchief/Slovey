import { loadEnv } from "@company-brain/config";
import { AGENTS, decisionApi, logger, preflight, resolveRepo } from "@company-brain/core";
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

const VERSION = "0.1.4";

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
const json = (v: unknown) => text(JSON.stringify(v, null, 2));
const errorText = (s: string) => ({ content: [{ type: "text" as const, text: s }], isError: true as const });

// Resolved once at startup, then reused.
let REPO_ID = "";
let REPO_SLUG = "";
/** Local repo dir Preflight runs its checks in (Claude Code launches us here). */
let REPO_PATH = "";

/**
 * Hosted mode. Set when SLOVEY_TOKEN is present: the server then reads the
 * decision graph over the hosted API instead of a direct Postgres connection.
 *
 * This exists because the published `slovey` package has no database. Before it,
 * the server called loadEnv() and resolveRepo() at startup and exited with
 * "DATABASE_URL is not set" for anyone who had not self-hosted — which was every
 * customer. Self-hosted deployments set DATABASE_URL and keep the direct path.
 */
let HOSTED: { apiUrl: string; token: string } | null = null;

/** One read against /api/cli/knowledge. The token is repo-scoped, so no repo id is sent. */
async function hostedRead(op: string, args: Record<string, unknown>): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch(`${HOSTED!.apiUrl}/api/cli/knowledge`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${HOSTED!.token}` },
      body: JSON.stringify({ op, args }),
      signal: ctrl.signal,
    });
    const body = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string; message?: string };
    if (!res.ok) {
      throw new Error(body.error || body.message || `Slovey API returned ${res.status}`);
    }
    return body.result ?? null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The decision-graph reads the tools use, resolved against whichever mode is
 * active. Keeping the call sites identical means a tool handler never has to
 * know how it is connected.
 */
const graph = {
  whatAppliesHere: (scope: Parameters<typeof decisionApi.whatAppliesHere>[1]) =>
    HOSTED
      ? (hostedRead("what_applies_here", scope as Record<string, unknown>) as ReturnType<typeof decisionApi.whatAppliesHere>)
      : decisionApi.whatAppliesHere(REPO_ID, scope),
  plan: (request: string) =>
    HOSTED
      ? (hostedRead("plan", { request }) as ReturnType<typeof decisionApi.plan>)
      : decisionApi.plan(REPO_ID, request),
  canI: (intent: string) =>
    HOSTED
      ? (hostedRead("can_i", { intent }) as ReturnType<typeof decisionApi.canI>)
      : decisionApi.canI(REPO_ID, intent),
  ask: (question: string) =>
    HOSTED
      ? (hostedRead("ask", { question }) as ReturnType<typeof decisionApi.ask>)
      : decisionApi.ask(REPO_ID, question),
  getRejectedKnowledge: (query?: string) =>
    HOSTED
      ? (hostedRead("rejected", { query }) as ReturnType<typeof decisionApi.getRejectedKnowledge>)
      : decisionApi.getRejectedKnowledge(REPO_ID, query),
};

/** Run history lives in the database; hosted accounts read it in the dashboard. */
function requireDirectMode(what: string): void {
  if (HOSTED) {
    throw new Error(
      `${what} needs a direct database connection, which hosted accounts do not have. ` +
        `Run the gate with "slovey preflight" and see run history at https://slovey.dev/app.`,
    );
  }
}

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
      const ctx = await graph.whatAppliesHere(scope);
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
      const p = await graph.plan(request);
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
      const r = await graph.canI(intent);
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
      const a = await graph.ask(question);
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
      const rows = await graph.getRejectedKnowledge(query);
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

  // ── Preflight: the gate agents run AFTER writing code, BEFORE committing ──

  server.registerTool(
    "preflight_run",
    {
      title: "Preflight — run all checks",
      description:
        "Run Company Brain Preflight on the local repo: typecheck, lint, tests, build, secret scan, architecture rules, and decision-graph checks. Returns structured JSON with pass/fail, safeToCommit/safeToPush, and exact fix instructions. Call this after writing code and BEFORE committing; if it fails, apply every fixInstruction and call it again (pass the same attemptId across the loop). Modes: full (default), quick (no test/build/decision), commit (quick + decision-check), push (=full), changed-files, planning (pre-code: returns governing decisions before you write anything).",
      inputSchema: {
        mode: z.enum(["full", "quick", "commit", "push", "changed-files", "planning"]).optional(),
        attemptId: z.string().optional(),
        changedFiles: z.array(z.string()).optional(),
        requiredChecks: z.array(z.string()).optional(),
        maxAttempts: z.number().int().positive().optional(),
        checkOnly: z.boolean().optional(),
      },
    },
    safe(
      "preflight_run",
      async (args: {
        mode?: preflight.PreflightMode;
        attemptId?: string;
        changedFiles?: string[];
        requiredChecks?: string[];
        maxAttempts?: number;
        checkOnly?: boolean;
      }) => {
        const r = await preflight.runPreflight({ cwd: REPO_PATH, repoId: REPO_ID, ...args });
        return json(r);
      },
    ),
  );

  server.registerTool(
    "preflight_status",
    {
      title: "Preflight — last status",
      description:
        "Return the status of the most recent Preflight run for this repo/branch WITHOUT re-running checks (pass/fail, safeToCommit, attempt number, whether human review is required).",
      inputSchema: {},
    },
    safe("preflight_status", async () => {
      requireDirectMode("Preflight run history");
      const run = await preflight.getLatestRun(REPO_ID, preflight.getBranch(REPO_PATH));
      if (!run) return text('No Preflight run yet. Call "preflight_run" first.');
      return json({
        status: run.status,
        safeToCommit: run.safeToCommit,
        safeToPush: run.safeToPush,
        mode: run.mode,
        summary: run.summary,
        agentInstruction: run.agentInstruction,
        attemptId: run.attemptId,
        attempt: run.attempt,
        maxAttempts: run.maxAttempts,
        humanReviewRequired: run.humanReviewRequired,
        branch: run.branch,
        createdAt: run.createdAt,
      });
    }),
  );

  server.registerTool(
    "preflight_fix_instructions",
    {
      title: "Preflight — fix instructions",
      description:
        "Return the agent-readable fix instructions and decision violations from the most recent Preflight run, highest priority first. Use this to know exactly what to change.",
      inputSchema: {},
    },
    safe("preflight_fix_instructions", async () => {
      requireDirectMode("Preflight run history");
      const run = await preflight.getLatestRun(REPO_ID, preflight.getBranch(REPO_PATH));
      if (!run) return text('No Preflight run yet. Call "preflight_run" first.');
      const detail = await preflight.getRunDetail(run.id);
      // New runs store instructions in preflight_fix_instructions; fall back to
      // the legacy merged columns for runs recorded before the split.
      const fixes =
        detail?.fixInstructions?.length
          ? detail.fixInstructions.map((f) => ({
              id: f.fingerprint,
              priority: f.priority,
              file: f.file,
              problem: f.problem,
              instructionForAgent: f.instructionForAgent,
              evidence: f.evidence,
            }))
          : (detail?.errors ?? []).map((e) => ({
              id: e.fingerprint,
              priority: e.priority,
              file: e.file,
              problem: e.message,
              instructionForAgent: e.instructionForAgent,
              evidence: e.evidence,
            }));
      return json({
        status: run.status,
        safeToCommit: run.safeToCommit,
        fixInstructions: fixes,
        decisionViolations: (detail?.violations ?? []).map((v) => ({
          decisionId: v.decisionId,
          title: v.title,
          violation: v.violation,
          instructionForAgent: v.instructionForAgent,
          confidence: v.confidence,
          evidence: v.evidence,
        })),
      });
    }),
  );

  server.registerTool(
    "preflight_validate_commit",
    {
      title: "Preflight — validate commit",
      description:
        "Run the commit gate (fast checks + decision-graph; run preflight_run mode:\"push\" for the full gate before pushing) and return ONLY the verdict. Use this immediately before committing or marking a task complete. If not safe, do not commit — fix and re-run.",
      inputSchema: { maxAttempts: z.number().int().positive().optional(), attemptId: z.string().optional() },
    },
    safe("preflight_validate_commit", async (args: { maxAttempts?: number; attemptId?: string }) => {
      const r = await preflight.runPreflight({ cwd: REPO_PATH, repoId: REPO_ID, mode: "commit", ...args });
      return json({
        verdict: r.safeToCommit ? "safe to commit" : "do not commit yet",
        safeToCommit: r.safeToCommit,
        safeToPush: r.safeToPush,
        status: r.status,
        attempt: r.attempt,
        humanReviewRequired: r.humanReviewRequired,
        agentInstruction: r.agentInstruction,
      });
    }),
  );

  server.registerTool(
    "preflight_list_checks",
    {
      title: "Preflight — list available checks",
      description:
        "List every check configured for this repository: name, kind (command/static/decision-graph), whether it is required (blocking), the resolved command, and whether it can actually run here.",
      inputSchema: {},
    },
    safe("preflight_list_checks", async () => json(preflight.listChecks(REPO_PATH))),
  );

  server.registerTool(
    "list_agents",
    {
      title: "List supervisor agents",
      description:
        "List Company Brain's AI-supervisor agent roster — one specialized agent per job (Security, Memory, Architecture, Tooling, Review) — with each agent's mission, stage, and the Preflight checks it owns.",
      inputSchema: {},
    },
    safe("list_agents", async () => json(AGENTS)),
  );

  server.registerTool(
    "preflight_config",
    {
      title: "Preflight — effective configuration",
      description:
        "Return the effective Preflight configuration for this repository (companybrain.preflight.json merged over defaults), plus whether it came from a config file.",
      inputSchema: {},
    },
    safe("preflight_config", async () => {
      const { config, source, warning } = preflight.loadPreflightConfig(REPO_PATH);
      return json({ source, warning, config });
    }),
  );

  server.registerTool(
    "preflight_explain_failure",
    {
      title: "Preflight — explain failure",
      description:
        "Explain, in plain language for the agent, why the latest Preflight run failed and what to do next. Optionally focus on one check by name, or pass an errorId (fingerprint from fixInstructions) to explain a single stored error.",
      inputSchema: { check: z.string().optional(), errorId: z.string().optional() },
    },
    safe("preflight_explain_failure", async ({ check, errorId }: { check?: string; errorId?: string }) => {
      if (errorId) {
        requireDirectMode("Error lookup");
        const found = await preflight.findErrorByFingerprint(REPO_ID, errorId);
        if (!found) return text(`No stored error with id "${errorId}". Ids come from fixInstructions[].id.`);
        const e = found.error;
        return text(
          `Error ${errorId} (${e.category ?? "unknown"} · check: ${e.checkName} · blocking priority: ${e.priority ?? "?"})\n` +
            `File: ${e.file || "(none)"}${e.line ? `:${e.line}` : ""}\n` +
            `Problem: ${e.message}\n` +
            (e.rawRedacted ? `Raw output: ${e.rawRedacted}\n` : "") +
            `\n${e.instructionForAgent ?? "Fix the problem above, then run preflight_run again."}`,
        );
      }
      requireDirectMode("Preflight run history");
      const run = await preflight.getLatestRun(REPO_ID, preflight.getBranch(REPO_PATH));
      if (!run) return text('No Preflight run yet. Call "preflight_run" first.');
      if (run.status === "pass") return text("The last Preflight run passed — safe to commit.");
      const detail = await preflight.getRunDetail(run.id);
      const checks = (detail?.checks ?? []).filter((c) => (check ? c.name === check : c.status === "fail"));
      const failing = checks.map((c) => `- ${c.name}: ${c.status}${c.skippedReason ? ` (${c.skippedReason})` : ""}`);
      const fixSource = detail?.fixInstructions?.length
        ? detail.fixInstructions.map((f) => ({ priority: f.priority, file: f.file, message: f.problem }))
        : (detail?.errors ?? []).map((e) => ({ priority: e.priority, file: e.file, message: e.message }));
      const fixes = fixSource.slice(0, 8).map((e) => `  • [${e.priority}] ${e.file || "(general)"}: ${e.message}`);
      const viol = (detail?.violations ?? []).map((v) => `  ! ${v.title}: ${v.violation}`);
      return text(
        `Preflight ${run.status.toUpperCase()} (attempt ${run.attempt}/${run.maxAttempts}). ${run.summary}\n\n` +
          `Failing checks:\n${failing.join("\n") || "(none)"}` +
          (fixes.length ? `\n\nTop fixes:\n${fixes.join("\n")}` : "") +
          (viol.length ? `\n\nDecision violations:\n${viol.join("\n")}` : "") +
          `\n\nAgent, fix these before continuing. Do not commit yet. Run Preflight again after fixing.` +
          (run.humanReviewRequired ? `\n\nNOTE: max attempts reached — human review required. Stop and ask a human.` : ""),
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
  // 1. Pick the mode BEFORE touching the database. A hosted user has a token and
  //    no DATABASE_URL; loading env first meant they never got this far.
  HOSTED = preflight.apiModeFromEnv();
  REPO_PATH = process.env.SLOVEY_REPO_PATH || process.env.COMPANY_BRAIN_REPO_PATH || process.cwd();

  if (HOSTED) {
    // The token is repo-scoped, so the server's scope comes from the token
    // itself — nothing to resolve, and no way to point it at another repo.
    REPO_SLUG = "(from token)";
  } else {
    // Self-hosted: environment (DATABASE_URL etc.) — loadEnv throws a readable list.
    try {
      loadEnv();
    } catch (e) {
      fatal(
        `${e instanceof Error ? e.message : String(e)}
` +
          `If you meant to use a hosted Slovey account, set SLOVEY_TOKEN instead — ` +
          `create one at https://slovey.dev/app and no database is needed.`,
      );
    }

    // Scope — required, validated, no silent default.
    let slug: ReturnType<typeof parseRepoSlug>;
    try {
      slug = parseRepoSlug(process.env.SLOVEY_REPO || process.env.COMPANY_BRAIN_REPO);
    } catch (e) {
      if (e instanceof ConfigError) fatal(e.message);
      throw e;
    }
    REPO_SLUG = slug.slug;

    // Resolve the repo NOW so misconfiguration fails at startup, not mid-tool.
    let resolved: Awaited<ReturnType<typeof resolveRepo>>;
    try {
      resolved = await resolveRepo(slug.slug);
    } catch (e) {
      fatal(`Could not reach the database to resolve "${slug.slug}": ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!resolved) {
      fatal(
        `Repository "${slug.slug}" is not connected to Slovey. Install the GitHub App on it (or check SLOVEY_REPO).`,
      );
    }
    REPO_ID = resolved.repoId;
  }

  // 4. Register tools + connect over stdio.
  const server = new McpServer({ name: "company-brain", version: VERSION });
  registerTools(server);
  await server.connect(new StdioServerTransport());
  // Stderr only — stdout is the JSON-RPC channel.
  process.stderr.write(`[slovey mcp] ready · ${HOSTED ? `hosted ${HOSTED.apiUrl}` : `repo ${REPO_SLUG}`} · v${VERSION}
`);
}

main().catch((e) => {
  process.stderr.write(`[slovey mcp] fatal: ${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exit(1);
});
