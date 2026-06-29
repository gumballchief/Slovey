import { loadEnv } from "@company-brain/config";
import { getApp, syncInstallation } from "@company-brain/core";
import { closeDb } from "@company-brain/db";

/** Verify GitHub App auth + sync all installations/repos into the DB. */
async function main() {
  loadEnv();
  const app = getApp();
  const { data } = await app.octokit.request("GET /app/installations", { per_page: 100 });
  if (data.length === 0) {
    console.log("No installations found. Install the app on gumballchief/pr-bot-test first.");
  }
  for (const inst of data) {
    const acct = (inst.account as { login?: string } | null)?.login ?? "?";
    console.log(`Syncing installation ${inst.id} (${acct})…`);
    await syncInstallation(inst.id);
  }
  console.log("Done.");
  await closeDb();
}

main().catch(async (e) => {
  console.error("sync-installs failed:", e);
  await closeDb();
  process.exit(1);
});
