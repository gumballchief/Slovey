/** Raised for misconfiguration — surfaced to the operator with a fix hint. */
export class ConfigError extends Error {}

export interface RepoSlug {
  owner: string;
  name: string;
  /** Canonical "owner/name". */
  slug: string;
}

/**
 * Parse + validate the COMPANY_BRAIN_REPO scope ("owner/name"). Pure and
 * deterministic so it can be unit-tested without a server. The MCP server is
 * scoped to exactly one repo's decision graph — never a silent default — so a
 * misconfigured client can't read the wrong organization's knowledge.
 */
export function parseRepoSlug(input: string | undefined): RepoSlug {
  const raw = (input ?? "").trim();
  if (!raw) {
    throw new ConfigError(
      "COMPANY_BRAIN_REPO is not set. Set it to the repository whose engineering decisions this server should serve, e.g. COMPANY_BRAIN_REPO=your-org/your-repo",
    );
  }
  // Accept a full GitHub URL or "owner/name"; reject anything ambiguous.
  const cleaned = raw
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "");
  const parts = cleaned.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new ConfigError(
      `COMPANY_BRAIN_REPO="${raw}" is not a valid "owner/name" repository slug.`,
    );
  }
  const [owner, name] = parts;
  const valid = /^[A-Za-z0-9._-]+$/;
  if (!valid.test(owner) || !valid.test(name)) {
    throw new ConfigError(
      `COMPANY_BRAIN_REPO="${raw}" contains invalid characters; expected "owner/name".`,
    );
  }
  return { owner, name, slug: `${owner}/${name}` };
}
