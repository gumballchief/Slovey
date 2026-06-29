import { ConfluenceConnector } from "./confluence";
import { DiscordConnector } from "./discord";
import { JiraConnector } from "./jira";
import { LinearConnector } from "./linear";
import { NotionConnector } from "./notion";
import { SlackConnector } from "./slack";
import type { ConnectorClient, ConnectorType } from "./types";

export * from "./types";
export { LinearConnector } from "./linear";
export { NotionConnector } from "./notion";
export { SlackConnector } from "./slack";
export { JiraConnector } from "./jira";
export { ConfluenceConnector } from "./confluence";
export { DiscordConnector } from "./discord";

/** Build the client for a connector type with its decrypted token. */
export function getConnectorClient(type: ConnectorType, token: string): ConnectorClient {
  switch (type) {
    case "linear":
      return new LinearConnector(token);
    case "notion":
      return new NotionConnector(token);
    case "slack":
      return new SlackConnector(token);
    case "jira":
      return new JiraConnector(token);
    case "confluence":
      return new ConfluenceConnector(token);
    case "discord":
      return new DiscordConnector(token);
  }
}
