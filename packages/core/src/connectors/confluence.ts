import type { ConnectorClient, ConnectorConfig, ConnectorDoc } from "./types";

interface ConfluencePage {
  id: string;
  title?: string;
  body?: { storage?: { value?: string } };
  _links?: { webui?: string };
}

/** Strip HTML tags + collapse whitespace from Confluence "storage" markup. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Confluence connector (Atlassian Cloud REST). Basic auth with account email +
 * API token. Reads recent pages (title + body) so RFCs and decision logs in the
 * wiki become citable decisions. Needs config.baseUrl + email.
 */
export class ConfluenceConnector implements ConnectorClient {
  readonly type = "confluence" as const;
  constructor(private readonly token: string) {}

  async fetchDocs(config: ConnectorConfig = {}): Promise<ConnectorDoc[]> {
    const baseUrl = config.baseUrl?.replace(/\/$/, "");
    if (!baseUrl || !config.email) {
      throw new Error("Confluence: configure the site URL and account email");
    }
    const auth = Buffer.from(`${config.email}:${this.token}`).toString("base64");
    const limit = Math.min(config.limit ?? 25, 50);
    const url = `${baseUrl}/wiki/rest/api/content?type=page&status=current&expand=body.storage&limit=${limit}`;

    const res = await fetch(url, {
      headers: { authorization: `Basic ${auth}`, accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Confluence ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { results?: ConfluencePage[] };

    return (json.results ?? []).map((page) => ({
      id: page.id,
      title: page.title ?? "Untitled",
      content: stripHtml(page.body?.storage?.value ?? ""),
      url: page._links?.webui ? `${baseUrl}/wiki${page._links.webui}` : `${baseUrl}/wiki`,
    }));
  }
}
