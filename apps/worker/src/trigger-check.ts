import { loadEnv } from "@company-brain/config";
import { checkPr, resolveRepo } from "@company-brain/core";
import { closeDb } from "@company-brain/db";

/** Manually run the check pipeline on a PR (for testing without a live webhook). */
async function main() {
  loadEnv();
  const num = Number(process.argv[2] ?? "1");
  const repo = await resolveRepo("gumballchief/pr-bot-test");
  if (!repo) {
    console.error("repo not found — run sync-installs first");
    process.exit(1);
  }
  console.log(`Checking PR #${num} on ${repo.fullName}…`);
  const r = await checkPr({
    repoId: repo.repoId,
    installationId: repo.installationGithubId,
    owner: repo.owner,
    name: repo.name,
    fullName: repo.fullName,
    prNumber: num,
    action: "manual",
  });
  console.log("RESULT:", JSON.stringify(r, null, 2));
  await closeDb();
}
main().catch(async (e) => {
  console.error("trigger-check failed:", e);
  await closeDb();
  process.exit(1);
});
