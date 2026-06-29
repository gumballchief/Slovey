import type { ConnectorClient, ConnectorConfig, ConnectorDoc } from "./types";

interface JiraIssue {
  key: string;
  fields?: {
    summary?: string;
    description?: unknown; // string (v2) or ADF object (v3)
    comment?: { comments?: Array<{ body?: unknown }> };
  };
}

/** Recursively pull plain text out of an Atlassian Document Format node (or a string). */
function adfText(node: unknown): string {
  if (typeof node === "string") return node;
  if (!node || typeof node !== "object") return "";
  const n = node as { text?: string; content?: unknown[] };
  let out = n.text ?? "";
  if (Array.isArray(n.content)) out += " " + n.content.map(adfText).join(" ");
  return out.trim();
}

/**
 * Jira connector (Atlassian Cloud REST v3). Basic auth with account email + API
 * token. Reads recent issues (summary, description, comments) so architecture
 * decisions captured in tickets become citable. Needs config.baseUrl + email.
 */
export class JiraConnector implements ConnectorClient {
  readonly type = "jira" as const;
  constructor(private readonly token: string) {}

  async fetchDocs(config: ConnectorConfig = {}): Promise<ConnectorDoc[]> {
    const baseUrl = config.baseUrl?.replace(/\/$/, "");
    if (!baseUrl || !config.email) {
      throw new Error("Jira: configure the site URL and account email");
    }
    const auth = Buffer.from(`${config.email}:${this.token}`).toString("base64");
    const max = Math.min(config.limit ?? 50, 100);
    const url = `${baseUrl}/rest/api/3/search?jql=${encodeURIComponent(
      "order by updated DESC",
    )}&maxResults=${max}&fields=summary,description,comment`;

    const res = await fetch(url, {
      headers: { authorization: `Basic ${auth}`, accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Jira ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { issues?: JiraIssue[] };

    return (json.issues ?? []).map((issue) => {
      const f = issue.fields ?? {};
      const comments = (f.comment?.comments ?? []).map((c) => adfText(c.body)).filter(Boolean);
      const content = [adfText(f.description), ...comments].filter(Boolean).join("\n\n");
      return {
        id: issue.key,
        title: `${issue.key} ${f.summary ?? ""}`.trim(),
        content,
        url: `${baseUrl}/browse/${issue.key}`,
      };
    });
  }
}
