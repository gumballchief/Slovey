import { loadEnv } from "@company-brain/config";
import { checkPr, resolveRepo } from "@company-brain/core";
import { closeDb, getDb, prChecks } from "@company-brain/db";
import { and, eq } from "drizzle-orm";

/** Clear any prior check for a PR and re-run (bypasses head-sha idempotency). */
async function main() {
  loadEnv();
  const n = Number(process.argv[2] ?? "8");
  const repo = await resolveRepo("gumballchief/pr-bot-test");
  if (!repo) throw new Error("repo not found");
  await getDb()
    .delete(prChecks)
    .where(and(eq(prChecks.repoId, repo.repoId), eq(prChecks.prNumber, n)));
  console.log(`Cleared prior checks for #${n}; re-running…`);
  const r = await checkPr({
    repoId: repo.repoId,
    installationId: repo.installationGithubId,
    owner: repo.owner,
    name: repo.name,
    fullName: repo.fullName,
    prNumber: n,
    action: "manual",
  });
  console.log("RESULT:", JSON.stringify(r, null, 2));
  await closeDb();
}
main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
