/**
 * The single canonical origin for the marketing site.
 *
 * Everything SEO-facing (metadataBase, canonicals, sitemap, robots, OG image
 * URLs) must agree on one origin. The app is also reachable on its Render
 * hostname, which would otherwise look to Google like a second, competing copy
 * of the whole site.
 */
export const SITE_URL = "https://slovey.ai";

export const CANONICAL_HOSTS = ["slovey.ai", "www.slovey.ai"] as const;

/**
 * The previous address. Its pages redirect to SITE_URL, but its API and auth
 * routes keep answering in place: installed CLIs, the GitHub App and Stripe
 * webhooks, and half-finished sign-ins all point here.
 */
export const LEGACY_HOSTS = ["slovey.dev", "www.slovey.dev"] as const;

/** Paths a legacy host serves itself instead of redirecting. */
export function servedOnLegacyHost(pathname: string): boolean {
  return pathname.startsWith("/api/") || pathname === "/api" || pathname.startsWith("/auth/");
}
