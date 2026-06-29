export type ConnectorType =
  | "linear"
  | "notion"
  | "slack"
  | "jira"
  | "confluence"
  | "discord";

export const CONNECTOR_TYPES: ConnectorType[] = [
  "linear",
  "notion",
  "slack",
  "jira",
  "confluence",
  "discord",
];

export function isConnectorType(s: string): s is ConnectorType {
  return (CONNECTOR_TYPES as string[]).includes(s);
}

/** Optional per-connector configuration (stored as jsonb alongside the token). */
export interface ConnectorConfig {
  /** Slack/Discord: channel IDs to read. Slack falls back to recent public channels. */
  channels?: string[];
  /** Jira/Confluence (Atlassian Cloud): the site base URL, e.g. https://acme.atlassian.net. */
  baseUrl?: string;
  /** Jira/Confluence: the account email paired with the API token (basic auth). */
  email?: string;
  /** Cap on documents fetched per sync (default per-connector). */
  limit?: number;
}

/** A normalized document fetched from an external source, ready for extraction. */
export interface ConnectorDoc {
  /** Stable id within the source (issue id, page id, channel id…). */
  id: string;
  title: string;
  content: string;
  /** A citable URL/permalink — becomes the decision's evidence. */
  url: string;
}

/** Every source client fetches documents the same way; the pipeline does the rest. */
export interface ConnectorClient {
  readonly type: ConnectorType;
  fetchDocs(config?: ConnectorConfig): Promise<ConnectorDoc[]>;
}
