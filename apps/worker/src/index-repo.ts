import { loadEnv } from "@company-brain/config";
import { resolveRepo, runIndexRepo } from "@company-brain/core";
import { closeDb } from "@company-brain/db";

/** Manually index a repo's code structure into repo_knowledge. */
async function main() {
  loadEnv();
  const full = process.argv[2] ?? "gumballchief/pr-bot-test";
  const repo = await resolveRepo(full);
  if (!repo) throw new Error(`repo not found: ${full}`);
  console.log(`Indexing ${repo.fullName}…`);
  const k = await runIndexRepo({
    repoId: repo.repoId,
    installationId: repo.installationGithubId,
    owner: repo.owner,
    name: repo.name,
    defaultBranch: repo.defaultBranch,
  });
  console.log("architecture:", JSON.stringify(k.architecture, null, 2));
  console.log("dependencyGraph nodes/edges:", k.dependencyGraph.nodes.length, "/", k.dependencyGraph.edges.length);
  console.log("conventions (citable decisions):", k.conventions);
  await closeDb();
}
main().catch(async (e) => {
  console.error("index-repo failed:", e);
  await closeDb();
  process.exit(1);
});
