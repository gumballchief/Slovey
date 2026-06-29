import { loadEnv } from "@company-brain/config";
import { getInstallationOctokit, resolveRepo } from "@company-brain/core";

/** Print the Company Brain comment(s) on a PR. */
async function main() {
  loadEnv();
  const n = Number(process.argv[2] ?? "8");
  const repo = await resolveRepo("gumballchief/pr-bot-test");
  if (!repo) throw new Error("repo not found");
  const ok = await getInstallationOctokit(repo.installationGithubId);
  const { data } = await ok.rest.issues.listComments({
    owner: repo.owner,
    repo: repo.name,
    issue_number: n,
    per_page: 30,
  });
  const bot = data.filter((c) => c.body?.includes("company-brain"));
  if (!bot.length) {
    console.log(`No Company Brain comment on PR #${n}.`);
    return;
  }
  for (const c of bot) console.log(`--- ${c.html_url} ---\n${c.body}`);
}
main();
