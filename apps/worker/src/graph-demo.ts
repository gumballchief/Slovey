import { loadEnv } from "@company-brain/config";
import { graph, reasoning, resolveRepo } from "@company-brain/core";
import { closeDb } from "@company-brain/db";

/** Demonstrate the graph write path + the Engineering Context API end-to-end. */
async function main() {
  loadEnv();
  const repo = await resolveRepo("gumballchief/pr-bot-test");
  if (!repo) throw new Error("repo not found");

  const d = await graph.createDecision(repo.repoId, {
    decision: "Billing money math must use integer minor units (cents), never floats.",
    title: "Billing uses integer cents",
    why: "Float arithmetic introduces rounding errors in financial calculations.",
    evidence: ["ADR-9", "PR #142"],
    source: "manual",
    importance: "critical",
    confidence: 0.95,
    services: ["billing"],
    domains: ["payments"],
    directories: ["apps/web/app/billing", "packages/core/src/services"],
    frameworks: ["Next.js"],
    languages: ["TypeScript"],
    ownerUser: "gumballchief",
    owningTeam: "payments",
    createdBy: "graph-demo",
  });
  console.log(`created decision ${d.id} status=${d.status} importance=${d.importance}`);

  const ctx = await reasoning.contextForScope(repo.repoId, {
    paths: ["apps/web/app/billing/page.tsx"],
    services: ["billing"],
  });
  console.log("CONSTRAINTS:", JSON.stringify(ctx.constraints, null, 2));
  console.log("PROMPT BLOCK:\n" + ctx.promptBlock);
  await closeDb();
}
main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
