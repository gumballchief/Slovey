import { listViewerRepos, requireViewer } from "@/lib/server/auth";
import { handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Repos the viewer can see: scoped to what they own or belong to (never all tenants'). */
export async function GET(): Promise<Response> {
  return handle(async () => ok(await listViewerRepos(await requireViewer())));
}
