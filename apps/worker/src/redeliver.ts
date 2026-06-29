import { loadEnv } from "@company-brain/config";
import { getApp } from "@company-brain/core";

/**
 * Re-send the most recent pull_request webhook delivery to exercise the full
 * automatic path. GitHub delivery IDs exceed JS's safe-integer range, so we read
 * the raw JSON and extract the id as a STRING (octokit would round it → 404).
 */
async function main() {
  loadEnv();
  const app = getApp();
  const auth = (await app.octokit.auth({ type: "app" })) as { token: string };
  const headers = {
    authorization: `Bearer ${auth.token}`,
    accept: "application/vnd.github+json",
    "user-agent": "company-brain",
    "x-github-api-version": "2022-11-28",
  };

  const res = await fetch("https://api.github.com/app/hook/deliveries?per_page=30", { headers });
  const raw = await res.text();
  // Flat delivery objects; grab the id of the first pull_request delivery as a string.
  const m = raw.match(/\{"id":(\d+)[^}]*?"event":"pull_request"[^}]*?\}/);
  if (!m) {
    console.log("No pull_request delivery found in raw response.");
    return;
  }
  const id = m[1];
  console.log(`Redelivering pull_request delivery id ${id}…`);
  const r = await fetch(`https://api.github.com/app/hook/deliveries/${id}/attempts`, {
    method: "POST",
    headers,
  });
  console.log(`Redeliver HTTP ${r.status}. ${r.ok ? "Watch the worker log." : await r.text()}`);
}
main();
