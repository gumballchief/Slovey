import type { ConnectorClient, ConnectorConfig, ConnectorDoc } from "./types";

const BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const MAX_CHILD_DEPTH = 4;
const MAX_BLOCKS_PER_DOC = 500;

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
function richTextToString(rich: unknown): string {
  if (!Array.isArray(rich)) return "";
  return rich.map((r) => (r as { plain_text?: string }).plain_text ?? "").join("");
}

/** Flatten a block to plain text, including non-rich_text bodies. */
function blockText(block: Record<string, unknown>): string {
  const type = block.type as string | undefined;
  if (!type) return "";
  if (type === "table_row") {
    const body = block[type] as { cells?: unknown } | undefined;
    if (!body || !Array.isArray(body.cells)) return "";
    return body.cells.map((cell) => richTextToString(cell)).filter(Boolean).join(" | ");
  }
  if (type === "child_page" || type === "child_database") {
    const body = block[type] as { title?: unknown } | undefined;
    return typeof body?.title === "string" ? body.title : "";
  }
  const body = block[type] as { rich_text?: unknown } | undefined;
  return richTextToString(body?.rich_text);
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

  private async listChildren(blockId: string, budget: number): Promise<Array<Record<string, unknown>>> {
    const out: Array<Record<string, unknown>> = [];
    if (budget <= 0) return out;
    let cursor: string | undefined;
    do {
      const url =
        `${BASE}/blocks/${blockId}/children?page_size=100` +
        (cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : "");
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) break;
      const json = (await res.json()) as {
        results?: Array<Record<string, unknown>>;
        has_more?: boolean;
        next_cursor?: string | null;
      };
      out.push(...(json.results ?? []).slice(0, budget - out.length));
      if (out.length >= budget) break;
      cursor = json.has_more ? (json.next_cursor ?? undefined) : undefined;
    } while (cursor);
    return out;
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
      const allBlocks: Array<Record<string, unknown>> = [];
      let content = "";
      try {
        allBlocks.push(...(await this.listChildren(page.id, MAX_BLOCKS_PER_DOC)));
        const queue: Array<{ id: string; depth: number }> = allBlocks
          .filter((b) => b.has_children === true && typeof b.id === "string")
          .map((b) => ({ id: b.id as string, depth: 0 }));
        const seen = new Set<string>([page.id]);
        while (queue.length > 0 && allBlocks.length < MAX_BLOCKS_PER_DOC) {
          const next = queue.shift();
          if (!next || seen.has(next.id)) continue;
          seen.add(next.id);
          const children = await this.listChildren(next.id, MAX_BLOCKS_PER_DOC - allBlocks.length);
          for (const child of children) {
            if (allBlocks.length >= MAX_BLOCKS_PER_DOC) break;
            allBlocks.push(child);
            if (
              child.has_children === true &&
              typeof child.id === "string" &&
              next.depth < MAX_CHILD_DEPTH &&
              !seen.has(child.id as string)
            ) {
              queue.push({ id: child.id as string, depth: next.depth + 1 });
            }
          }
        }
        content = allBlocks.map(blockText).filter(Boolean).join("\n");
      } catch {
        // a single page's blocks failing shouldn't abort the whole sync
        if (!content && allBlocks.length > 0) {
          content = allBlocks.map(blockText).filter(Boolean).join("\n");
        }
      }
      docs.push({ id: page.id, title: pageTitle(page), content, url: page.url });
    }
    return docs;
  }
}
