/**
 * The single canonical origin for the marketing site.
 *
 * Everything SEO-facing (metadataBase, canonicals, sitemap, robots, OG image
 * URLs) must agree on one origin. The app is also reachable on its Render
 * hostname, which would otherwise look to Google like a second, competing copy
 * of the whole site.
 */
export const SITE_URL = "https://slovey.dev";

export const CANONICAL_HOSTS = ["slovey.dev", "www.slovey.dev"] as const;
