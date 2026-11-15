import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Consent, ConsentProblem } from "@/features/oauth/Consent";
import { getViewer, listViewerRepos } from "@/lib/server/auth";
import { OAuthError, parseAuthorizeRequest } from "@/lib/server/oauth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in with Slovey", robots: { index: false, follow: false } };

/**
 * OAuth authorization endpoint. An MCP client (claude.ai, Claude Desktop, Cursor...)
 * sends the user here; they sign in, pick the repository the agent may read, and
 * are sent back to the client with a one-time code.
 */
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value != null) params.set(k, value);
  }

  let authz;
  try {
    authz = parseAuthorizeRequest(params);
  } catch (e) {
    return <ConsentProblem message={e instanceof OAuthError ? e.message : "This sign-in link is broken."} />;
  }

  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${params.toString()}`)}`);

  const repos = await listViewerRepos(viewer);
  return (
    <Consent
      request={params.toString()}
      clientName={authz.client.name}
      returnHost={new URL(authz.redirectUri).host}
      login={viewer.login}
      canIssue={viewer.isDev || viewer.githubId != null}
      repos={repos
        .map((r) => ({ id: r.id, name: r.name, decisions: r.decisionsCount }))
        .sort((a, b) => b.decisions - a.decisions || a.name.localeCompare(b.name))}
    />
  );
}
