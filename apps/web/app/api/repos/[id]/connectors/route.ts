import { listRepoConnectors } from "@company-brain/core";
import { assertRepoAccess, requireViewer } from "@/lib/server/auth";
import { handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Connector catalogue. Layer 1–2 live; Layer 3 connectable; others coming soon. */
const CONNECTORS = [
  { id: "github", name: "GitHub", layer: 1, status: "connected", description: "PR history, merged code, and review comments.", deepens: "Every merged PR is a potential decision.", icon: "github" },
  { id: "readme", name: "README / CONTRIBUTING", layer: 2, status: "connected", description: "Repo documentation files.", deepens: "Written conventions become searchable decisions.", icon: "file-text" },
  { id: "adrs", name: "ADRs / Docs folder", layer: 2, status: "connected", description: "Architecture Decision Records and /docs.", deepens: "Formal decisions get the highest confidence weighting.", icon: "book-open" },
  { id: "linear", name: "Linear", layer: 3, status: "available", description: "Issues, projects, and team decisions made in tickets.", deepens: "Rejected approaches in Linear become PR warnings.", icon: "layers" },
  { id: "notion", name: "Notion", layer: 3, status: "available", description: "Wikis, RFCs, and team docs.", deepens: "Every RFC and decision doc feeds the memory.", icon: "layout" },
  { id: "slack", name: "Slack", layer: 3, status: "available", description: "Channel decisions, thread consensus, pinned messages.", deepens: "Capture the decisions that only exist in Slack threads.", icon: "message-square" },
  { id: "jira", name: "Jira", layer: 3, status: "available", description: "Tickets, epics, and decision comments.", deepens: "Architecture decisions buried in Jira surface automatically.", icon: "trello" },
  { id: "confluence", name: "Confluence", layer: 3, status: "available", description: "Enterprise knowledge base and decision logs.", deepens: "Years of institutional knowledge become active PR context.", icon: "database" },
  { id: "discord", name: "Discord", layer: 3, status: "available", description: "Community and team channel decisions.", deepens: "OSS project decisions from Discord feed the memory.", icon: "hash" },
  { id: "meetings", name: "Meeting Notes", layer: 4, status: "coming_soon", description: "Transcripts from Zoom, Google Meet, Loom.", deepens: "Verbal decisions get captured before they're forgotten.", icon: "video" },
] as const;

/** The catalogue with live status merged in for any configured connectors. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    await assertRepoAccess(id, viewer);

    const configured = new Map((await listRepoConnectors(id)).map((c) => [c.type, c]));
    const merged = CONNECTORS.map((c) => {
      const live = configured.get(c.id);
      if (!live) return c;
      return {
        ...c,
        status: "connected" as const,
        lastSyncedAt: live.lastSyncedAt,
        lastError: live.lastError,
        syncing: live.status === "syncing",
      };
    });
    return ok(merged);
  });
}
