import { describe, it, expect, vi, afterEach } from "vitest";
import { SlackConnector } from "../src/connectors/slack";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("slack per-channel budget", () => {
  it("bounds accumulated content and stops thread fetches once reached", async () => {
    let replyCalls = 0;
    const text = "x".repeat(500);
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      let body: unknown;
      if (url.includes("conversations.history")) {
        body = {
          ok: true,
          messages: Array.from({ length: 200 }, (_, i) => ({
            text,
            ts: String(i + 1),
            reply_count: 1,
          })),
        };
      } else if (url.includes("conversations.replies")) {
        replyCalls++;
        body = {
          ok: true,
          messages: Array.from({ length: 51 }, (_, i) => ({
            text,
            ts: `r${i}`,
          })),
        };
      } else {
        body = { ok: true, channels: [] };
      }
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const docs = await new SlackConnector("token").fetchDocs({ channels: ["C1"], limit: 200 });
    expect(docs).toHaveLength(1);
    expect(docs[0].content.length).toBeLessThanOrEqual(100_000);
    expect(docs[0].content.split("\n").length).toBeLessThanOrEqual(1000);
    expect(replyCalls).toBeLessThan(20);
  });
});
