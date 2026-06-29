import type { ConnectorClient, ConnectorConfig, ConnectorDoc } from "./types";

const BASE = "https://discord.com/api/v10";

interface DiscordMessage {
  content?: string;
  type?: number;
}

/**
 * Discord connector (bot token). Reads recent messages from the configured
 * channel IDs and turns each channel's discussion into one document. The bot
 * must be in the server and able to read those channels. Channel IDs are
 * required (Discord has no cheap "list my channels" without a guild context).
 */
export class DiscordConnector implements ConnectorClient {
  readonly type = "discord" as const;
  constructor(private readonly token: string) {}

  private headers(): Record<string, string> {
    return { authorization: `Bot ${this.token}` };
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Discord ${path} ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  }

  async fetchDocs(config: ConnectorConfig = {}): Promise<ConnectorDoc[]> {
    const channels = config.channels ?? [];
    if (channels.length === 0) {
      throw new Error("Discord: configure at least one channel ID to sync");
    }
    const perChannel = Math.min(config.limit ?? 100, 100);
    const docs: ConnectorDoc[] = [];
    for (const id of channels) {
      try {
        const meta = await this.get<{ name?: string }>(`/channels/${id}`);
        const messages = await this.get<DiscordMessage[]>(
          `/channels/${id}/messages?limit=${perChannel}`,
        );
        const text = messages
          .filter((m) => m.content)
          .map((m) => m.content!.trim())
          .filter(Boolean)
          .join("\n");
        if (!text) continue;
        docs.push({
          id,
          title: `#${meta.name ?? id}`,
          content: text,
          url: `https://discord.com/channels/@me/${id}`,
        });
      } catch {
        // skip channels the bot can't read
      }
    }
    return docs;
  }
}
