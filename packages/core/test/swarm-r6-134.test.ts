import { describe, it, expect, vi, afterEach } from "vitest";
import { DiscordConnector } from "../src/connectors/discord";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("discord connector chronology (R6-134)", () => {
  it("presents channel messages oldest-first", async () => {
    const newestFirst = [
      { content: "third: ship it" },
      { content: "second: what about latency?" },
      { content: "first: should we cache?" },
    ];
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/channels/C1")) {
        return { ok: true, json: async () => ({ name: "general" }), text: async () => "" };
      }
      if (url.includes("/channels/C1/messages")) {
        return { ok: true, json: async () => newestFirst, text: async () => "" };
      }
      return { ok: false, status: 404, text: async () => "not found", json: async () => ({}) };
    });
    const connector = new DiscordConnector("token");
    const docs = await connector.fetchDocs({ channels: ["C1"] });
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toBe(
      "first: should we cache?\nsecond: what about latency?\nthird: ship it",
    );
  });
});
