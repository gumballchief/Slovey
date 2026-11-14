import { describe, it, expect, vi, afterEach } from "vitest";
import { SlackConnector } from "../src/connectors/slack";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(handler: (url: string) => unknown) {
  vi.stubGlobal(
    "fetch",
    async (input: string) => {
      const url = String(input);
      const payload = handler(url);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  );
}

describe("slack thread errors", () => {
  it("keeps the channel when a thread is rate limited (one thread must not fail the whole sync)", async () => {
    stubFetch((url) => {
      if (url.includes("conversations.history")) {
        return {
          ok: true,
          messages: [{ text: "top level", ts: "1.0", reply_count: 2 }],
        };
      }
      if (url.includes("conversations.replies")) {
        return { ok: false, error: "rate_limited" };
      }
      return { ok: true, channels: [] };
    });
    const c = new SlackConnector("xoxb-test");
    const docs = await c.fetchDocs({ channels: ["C123"] });
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toContain("top level");
  });

  it("still skips threads the bot cannot read", async () => {
    stubFetch((url) => {
      if (url.includes("conversations.history")) {
        return {
          ok: true,
          messages: [{ text: "top level", ts: "1.0", reply_count: 2 }],
        };
      }
      if (url.includes("conversations.replies")) {
        return { ok: false, error: "missing_scope" };
      }
      return { ok: true, channels: [] };
    });
    const c = new SlackConnector("xoxb-test");
    const docs = await c.fetchDocs({ channels: ["C123"] });
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toContain("top level");
  });
});
