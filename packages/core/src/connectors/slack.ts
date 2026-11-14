import type { ConnectorClient, ConnectorConfig, ConnectorDoc } from "./types";

const BASE = "https://slack.com/api";

const MAX_LINES_PER_CHANNEL = 1000;
const MAX_CHARS_PER_CHANNEL = 100_000;

interface SlackChannel {
  id: string;
  name: string;
}
interface SlackMessage {
  text?: string;
  subtype?: string;
  ts?: string;
  user?: string;
  thread_ts?: string;
  reply_count?: number;
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
      return config.channels.slice(0, 20).map((id) => ({ id, name: id }));
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
        const messages = [...(hist.messages ?? [])].reverse();
        const lines: string[] = [];
        let charCount = 0;
        for (const m of messages) {
          if (!m.text || m.subtype) continue;
          const t = m.text.trim();
          if (!t) continue;
          if (lines.length >= MAX_LINES_PER_CHANNEL || charCount + t.length > MAX_CHARS_PER_CHANNEL) break;
          lines.push(t);
          charCount += t.length + 1;
        }
        for (const parent of messages) {
          if (lines.length >= MAX_LINES_PER_CHANNEL || charCount >= MAX_CHARS_PER_CHANNEL) break;
          if (!parent.ts) continue;
          const isThreadParent =
            (parent.reply_count !== undefined && parent.reply_count > 0) ||
            parent.thread_ts !== undefined;
          if (!isThreadParent) continue;
          try {
            const thread = await this.call<{ messages?: SlackMessage[] }>(
              "conversations.replies",
              {
                channel: ch.id,
                ts: parent.ts,
                limit: String(perChannel),
              },
            );
            for (const reply of thread.messages ?? []) {
              if (lines.length >= MAX_LINES_PER_CHANNEL || charCount >= MAX_CHARS_PER_CHANNEL) break;
              if (reply.ts === parent.ts) continue;
              if (!reply.text || reply.subtype) continue;
              const t = reply.text.trim();
              if (!t) continue;
              const bounded = t.slice(0, MAX_CHARS_PER_CHANNEL - charCount);
              lines.push(bounded);
              charCount += bounded.length + 1;
            }
          } catch {
            // Skip a thread we can't read (scope, or Slack's per-minute rate limit on
            // conversations.replies): failing the whole sync would lose every channel.
          }
        }
        const text = lines.join("\n");
        if (!text) continue;
        docs.push({
          id: ch.id,
          title: `#${ch.name}`,
          content: text,
          url: `slack://channel/${ch.id}`,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("channel_not_found") || msg.includes("not_in_channel")) continue;
        throw e;
      }
    }
    return docs;
  }
}
