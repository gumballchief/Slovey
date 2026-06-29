import type { ConnectorClient, ConnectorConfig, ConnectorDoc } from "./types";

const ENDPOINT = "https://api.linear.app/graphql";

interface LinearIssue {
  identifier: string;
  title: string;
  description?: string | null;
  url: string;
  comments?: { nodes: Array<{ body: string }> };
}

/**
 * Linear connector. Reads recent issues (title, description, comments) via the
 * GraphQL API. The personal API key is sent as the Authorization header.
 * Rejected approaches written up in Linear become citable decisions.
 */
export class LinearConnector implements ConnectorClient {
  readonly type = "linear" as const;
  constructor(private readonly token: string) {}

  async fetchDocs(config: ConnectorConfig = {}): Promise<ConnectorDoc[]> {
    const first = Math.min(config.limit ?? 50, 100);
    const query = `query Issues($first:Int!){issues(first:$first,orderBy:updatedAt){nodes{identifier title description url comments{nodes{body}}}}}`;
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: this.token },
      body: JSON.stringify({ query, variables: { first } }),
    });
    if (!res.ok) throw new Error(`Linear ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as {
      data?: { issues?: { nodes?: LinearIssue[] } };
      errors?: Array<{ message: string }>;
    };
    if (json.errors?.length) throw new Error(`Linear: ${json.errors[0]!.message}`);

    const nodes = json.data?.issues?.nodes ?? [];
    return nodes.map((n) => {
      const comments = (n.comments?.nodes ?? []).map((c) => c.body).filter(Boolean).join("\n");
      const content = [n.description ?? "", comments].filter(Boolean).join("\n\n");
      return { id: n.identifier, title: `${n.identifier} ${n.title}`, content, url: n.url };
    });
  }
}
