import { loadEnv } from "@company-brain/config";
import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";

let _app: App | null = null;

/** The GitHub App. All repo reads/writes use installation tokens minted here. */
export function getApp(): App {
  if (_app) return _app;
  const env = loadEnv();
  if (!env.GITHUB_APP_ID) throw new Error("GITHUB_APP_ID not configured");
  _app = new App({
    appId: env.GITHUB_APP_ID,
    privateKey: env.githubAppPrivateKey(),
    // Use the rest-enabled Octokit so installation clients expose `.rest.*`.
    Octokit,
    ...(env.GITHUB_WEBHOOK_SECRET
      ? { webhooks: { secret: env.GITHUB_WEBHOOK_SECRET } }
      : {}),
    ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? { oauth: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } }
      : {}),
  });
  return _app;
}

/** An Octokit (with `.rest`) scoped to a single installation. */
export type InstallationOctokit = Octokit;

export async function getInstallationOctokit(
  installationId: number,
): Promise<InstallationOctokit> {
  const octokit = await getApp().getInstallationOctokit(installationId);
  return octokit as unknown as InstallationOctokit;
}
