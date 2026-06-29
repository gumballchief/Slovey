import { dashboard } from "@company-brain/core";
import { requireViewer } from "@/lib/server/auth";
import { handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Repos the viewer can see. */
export async function GET(): Promise<Response> {
  return handle(async () => {
    await requireViewer();
    return ok(await dashboard.listRepos());
  });
}
