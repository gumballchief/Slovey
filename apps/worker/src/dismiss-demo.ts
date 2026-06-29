import { loadEnv } from "@company-brain/config";
import { getDismissedNotes, parseWebhook, recordFeedback, resolveRepo } from "@company-brain/core";
import { closeDb } from "@company-brain/db";

/**
 * Simulate a "/brain dismiss" PR comment exactly as the webhook handler would:
 * build the issue_comment payload GitHub sends, run it through the real
 * parseWebhook, then recordFeedback for each intent. Usage: dismiss-demo.ts <pr> [user]
 */
async function main() {
  loadEnv();
  const num = Number(process.argv[2] ?? "9");
  const user = process.argv[3] ?? "gumballchief";
  const repo = await resolveRepo("gumballchief/pr-bot-test");
  if (!repo) throw new Error("repo not found");

  const payload = {
    action: "created",
    installation: { id: repo.installationGithubId },
    repository: { full_name: repo.fullName },
    issue: { number: num, pull_request: { url: "https://api.github.com/.../pulls/" + num } },
    comment: { body: "/brain dismiss", user: { login: user, type: "User" } },
  };

  const intents = parseWebhook("issue_comment", payload);
  console.log("parsed intents:", JSON.stringify(intents));

  for (const i of intents) {
    if (i.type === "feedback") {
      const row = await recordFeedback({
        repoId: repo.repoId,
        prNumber: i.prNumber,
        action: i.action,
        byUser: i.byUser,
        reason: i.reason,
      });
      console.log(`recorded: action=${row?.action} decisionId=${row?.decisionId} by=${row?.byUser}`);
    }
  }

  console.log("dismissed notes now:", JSON.stringify(await getDismissedNotes(repo.repoId)));
  await closeDb();
}

main().catch(async (e) => {
  console.error("dismiss-demo failed:", e);
  await closeDb();
  process.exit(1);
});
