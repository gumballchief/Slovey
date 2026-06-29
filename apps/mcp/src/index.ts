import { loadEnv } from "@company-brain/config";
import { decisionApi, resolveRepo } from "@company-brain/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/**
 * Company Brain MCP server — the knowledge layer coding agents (Cursor, Claude
 * Code, …) call BEFORE generating code. Every tool reads the Engineering
 * Decision Graph through the Decision API; nothing bypasses it.
 *
 * Scope: set COMPANY_BRAIN_REPO=owner/name (defaults to the dev test repo).
 */
loadEnv();
const REPO = process.env.COMPANY_BRAIN_REPO ?? "gumballchief/pr-bot-test";

let cachedRepoId: string | null = null;
async function repoId(): Promise<string> {
  if (cachedRepoId) return cachedRepoId;
  const r = await resolveRepo(REPO);
  if (!r) throw new Error(`Repo not found: ${REPO} (set COMPANY_BRAIN_REPO)`);
  cachedRepoId = r.repoId;
  return cachedRepoId;
}

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });

const server = new McpServer({ name: "company-brain", version: "0.1.0" });

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
  async (scope) => {
    const ctx = await decisionApi.whatAppliesHere(await repoId(), scope);
    return text(ctx.constraints.length ? ctx.promptBlock : "No recorded decisions govern this area yet.");
  },
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
  async ({ intent }) => {
    const r = await decisionApi.canI(await repoId(), intent);
    const cites = r.citations.map((c) => `  - ${c.decision} [${c.evidence.join(", ")}]`).join("\n");
    const rej = r.rejectedPrecedent
      .map((p) => `  - REJECTED: ${p.decision}${p.rejectionReason ? ` (${p.rejectionReason})` : ""}`)
      .join("\n");
    return text(
      `verdict: ${r.verdict.toUpperCase()}\n${r.rationale}` +
        (cites ? `\n\nbased on:\n${cites}` : "") +
        (rej ? `\n\nrejected precedent:\n${rej}` : ""),
    );
  },
);

// Pre-code planning: an evidence-backed implementation plan that respects
// recorded decisions. The "think before you code" entry point for agents.
server.registerTool(
  "plan",
  {
    title: "Plan before coding",
    description:
      "Produce an evidence-backed implementation plan for an engineering request, respecting the team's recorded decisions. Returns intent, verdict (allowed/disallowed), risk, conflicts (blockers), active constraints, rejected precedent, and step-by-step plan. Call this BEFORE starting non-trivial work.",
    inputSchema: { request: z.string() },
  },
  async ({ request }) => {
    const p = await decisionApi.plan(await repoId(), request);
    const steps = p.steps.map((s, i) => `  ${i + 1}. ${s.title} — ${s.detail}`).join("\n");
    const constraints = p.constraints.map((c) => `  - ${c.decision}`).join("\n");
    const conflicts = p.conflicts.map((c) => `  ! ${c}`).join("\n");
    return text(
      `intent: ${p.intent} | verdict: ${p.verdict.toUpperCase()} | risk: ${p.risk} | confidence: ${p.confidence}\n\n${p.summary}` +
        (conflicts ? `\n\nblockers:\n${conflicts}` : "") +
        (steps ? `\n\nplan:\n${steps}` : "") +
        (constraints ? `\n\nactive constraints:\n${constraints}` : ""),
    );
  },
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
  async ({ question }) => {
    const a = await decisionApi.ask(await repoId(), question);
    const cites = a.citations.map((c) => `  - ${c.decision} [${c.evidence.join(", ")}]`).join("\n");
    return text(`${a.answer}\n(confidence: ${a.confidence})` + (cites ? `\n\nsources:\n${cites}` : ""));
  },
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
  async ({ query }) => {
    const rows = await decisionApi.getRejectedKnowledge(await repoId(), query);
    if (rows.length === 0) return text("No rejected approaches recorded for this query.");
    return text(
      rows
        .map(
          (r) =>
            `- ${r.decision}${r.rejectionReason ? `\n    why: ${r.rejectionReason}` : ""}${r.alternatives.length ? `\n    instead: ${r.alternatives.join(", ")}` : ""}`,
        )
        .join("\n"),
    );
  },
);

async function main() {
  await server.connect(new StdioServerTransport());
  // Stderr only — stdout is the JSON-RPC channel.
  console.error(`company-brain MCP server ready (repo: ${REPO})`);
}

main().catch((e) => {
  console.error("MCP server failed:", e);
  process.exit(1);
});
