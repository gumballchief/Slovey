import { loadEnv } from "@company-brain/config";
import { resolveRepo, runAgentTask } from "@company-brain/core";
import { closeDb } from "@company-brain/db";

/** Manually run the auto-PR agent: draft a change and open a PR. */
async function main() {
  loadEnv();
  const full = process.argv[2];
  const intent = process.argv.slice(3).join(" ").trim();
  if (!full || !intent) {
    console.error('Usage: pnpm --filter @company-brain/worker agent "<owner/repo>" "<what to build>"');
    process.exit(1);
  }
  const repo = await resolveRepo(full);
  if (!repo) throw new Error(`repo not found (is the App installed + synced?): ${full}`);

  console.log(`Agent working on ${repo.fullName}:\n  "${intent}"\n`);
  const r = await runAgentTask({
    repoId: repo.repoId,
    installationId: repo.installationGithubId,
    owner: repo.owner,
    name: repo.name,
    fullName: repo.fullName,
    defaultBranch: repo.defaultBranch,
    intent,
  });
  console.log(`✓ ${r.draft ? "Draft PR" : "PR"} #${r.prNumber} opened: ${r.prUrl}`);
  console.log(`  file: ${r.path} (${r.isNew ? "new" : "modified"})`);
  console.log(`  branch: ${r.branch}  ·  decisions honored: ${r.decisionsUsed}`);
  await closeDb();
}

main().catch(async (e) => {
  console.error("agent failed:", e);
  await closeDb();
  process.exit(1);
});
