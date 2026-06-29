import type { ConnectorClient, ConnectorConfig, ConnectorDoc } from "./types";

const BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

interface NotionPage {
  id: string;
  url: string;
  properties?: Record<string, unknown>;
}

/** Pull a human title out of a page's properties (title-typed property). */
function pageTitle(page: NotionPage): string {
  const props = page.properties ?? {};
  for (const v of Object.values(props)) {
    const p = v as { type?: string; title?: Array<{ plain_text?: string }> };
    if (p?.type === "title" && Array.isArray(p.title)) {
      const t = p.title.map((x) => x.plain_text ?? "").join("").trim();
      if (t) return t;
    }
  }
  return "Untitled";
}

/** Flatten a block's rich_text array to plain text. */
function blockText(block: Record<string, unknown>): string {
  const type = block.type as string | undefined;
  if (!type) return "";
  const body = block[type] as { rich_text?: Array<{ plain_text?: string }> } | undefined;
  return (body?.rich_text ?? []).map((r) => r.plain_text ?? "").join("");
}

/**
 * Notion connector. Searches for pages (internal integration token), then reads
 * each page's top-level blocks as plain text. RFCs and decision docs become
 * citable decisions.
 */
export class NotionConnector implements ConnectorClient {
  readonly type = "notion" as const;
  constructor(private readonly token: string) {}

  private headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.token}`,
      "notion-version": NOTION_VERSION,
      "content-type": "application/json",
    };
  }

  async fetchDocs(config: ConnectorConfig = {}): Promise<ConnectorDoc[]> {
    const limit = Math.min(config.limit ?? 25, 50);
    const res = await fetch(`${BASE}/search`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        filter: { property: "object", value: "page" },
        page_size: limit,
        sort: { direction: "descending", timestamp: "last_edited_time" },
      }),
    });
    if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { results?: NotionPage[] };
    const pages = json.results ?? [];

    const docs: ConnectorDoc[] = [];
    for (const page of pages) {
      let content = "";
      try {
        const blocksRes = await fetch(`${BASE}/blocks/${page.id}/children?page_size=100`, {
          headers: this.headers(),
        });
        if (blocksRes.ok) {
          const blocks = (await blocksRes.json()) as { results?: Array<Record<string, unknown>> };
          content = (blocks.results ?? []).map(blockText).filter(Boolean).join("\n");
        }
      } catch {
        // a single page's blocks failing shouldn't abort the whole sync
      }
      docs.push({ id: page.id, title: pageTitle(page), content, url: page.url });
    }
    return docs;
  }
}
