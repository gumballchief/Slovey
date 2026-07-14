/**
 * The GitHub App users install to connect a repository.
 *
 * The slug is env-overridable (NEXT_PUBLIC_GITHUB_APP_SLUG) with a correct
 * default, so it can never silently drift to the wrong app again: it was
 * previously hardcoded in four places to "company-brain" — a *private* GitHub
 * App owned by someone else — which dead-ended the entire connect-a-repo flow
 * (users landed on GitHub's "this is a private app" page with nothing to click).
 * The real app is "slovey-dev" (github.com/apps/slovey-dev), owned by us.
 */
export const GITHUB_APP_SLUG = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG || "slovey-dev";
export const GITHUB_APP_INSTALL_URL = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`;
