import type { ConnectorClient, ConnectorConfig, ConnectorDoc } from "./types";

const BASE = "https://slack.com/api";

interface SlackChannel {
  id: string;
  name: string;
}
interface SlackMessage {
  text?: string;
  subtype?: string;
}

/**
 * Slack connector (Web API, bot token). Reads recent messages from the
 * configured channels — or the most recent public channels if none are given —
 * and turns each channel's discussion into one document. Decisions that only
 * ever lived in a Slack thread become citable.
 */
export class SlackConnector implements ConnectorClient {
  readonly type = "slack" as const;
  constructor(private readonly token: string) {}

  private async call<T>(method: string, params: Record<string, string>): Promise<T> {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE}/${method}?${qs}`, {
      headers: { authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) throw new Error(`Slack ${method} ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { ok: boolean; error?: string } & T;
    if (!json.ok) throw new Error(`Slack ${method}: ${json.error ?? "unknown error"}`);
    return json;
  }

  private async resolveChannels(config: ConnectorConfig): Promise<SlackChannel[]> {
    if (config.channels?.length) {
      return config.channels.map((id) => ({ id, name: id }));
    }
    const data = await this.call<{ channels?: SlackChannel[] }>("conversations.list", {
      types: "public_channel",
      exclude_archived: "true",
      limit: "20",
    });
    return data.channels ?? [];
  }

  async fetchDocs(config: ConnectorConfig = {}): Promise<ConnectorDoc[]> {
    const perChannel = Math.min(config.limit ?? 100, 200);
    const channels = await this.resolveChannels(config);
    const docs: ConnectorDoc[] = [];
    for (const ch of channels) {
      try {
        const hist = await this.call<{ messages?: SlackMessage[] }>("conversations.history", {
          channel: ch.id,
          limit: String(perChannel),
        });
        const text = (hist.messages ?? [])
          .filter((m) => m.text && !m.subtype)
          .map((m) => m.text!.trim())
          .filter(Boolean)
          .join("\n");
        if (!text) continue;
        docs.push({
          id: ch.id,
          title: `#${ch.name}`,
          content: text,
          url: `slack://channel/${ch.id}`,
        });
      } catch {
        // skip channels the bot isn't in
      }
    }
    return docs;
  }
}
