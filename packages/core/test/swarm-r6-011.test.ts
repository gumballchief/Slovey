import { describe, it, expect, vi, afterEach } from "vitest";
import { SlackConnector } from "../src/connectors/slack";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("slack thread replies", () => {
  it("appends thread-only decision text to the channel document", async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes("conversations.replies")) {
        return {
          ok: true,
          text: async () => "",
          json: async () => ({
            ok: true,
            messages: [
              { text: "top-level hello", ts: "111" },
              { text: "thread-only decision: use postgres", ts: "111.1", thread_ts: "111" },
            ],
          }),
        };
      }
      if (url.includes("conversations.history")) {
        return {
          ok: true,
          text: async () => "",
          json: async () => ({
            ok: true,
            messages: [
              { text: "top-level hello", ts: "111", thread_ts: "111", reply_count: 1 },
            ],
          }),
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const connector = new SlackConnector("xoxb-test");
    const docs = await connector.fetchDocs({ channels: ["C123"], limit: 10 });
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toContain("thread-only decision: use postgres");
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("conversations.replies"))).toBe(true);
  });
});
