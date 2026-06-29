import { loadEnv } from "@company-brain/config";
import { runRescanPrs, stopBoss } from "@company-brain/core";
import { closeDb } from "@company-brain/db";

/**
 * Manually trigger the open-PR rescan (what the cron does on a schedule).
 * Usage: pnpm --filter @company-brain/worker exec tsx src/rescan.ts [repoId]
 */
async function main() {
  loadEnv();
  const repoId = process.argv[2];
  const r = await runRescanPrs(repoId);
  console.log(`Queued checks for ${r.prsQueued} open PR(s) across ${r.repos} repo(s).`);
  await stopBoss();
  await closeDb();
}

main().catch(async (e) => {
  console.error("rescan failed:", e);
  await stopBoss();
  await closeDb();
  process.exit(1);
});
