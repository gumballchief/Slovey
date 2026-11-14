import { describe, it, expect, vi, afterEach } from "vitest";
import { SlackConnector } from "../src/connectors/slack";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SlackConnector chronology", () => {
  it("presents channel history oldest-first, reversing the API order without mutating it", async () => {
    const apiMessages = [
      { text: "newest: use B", ts: "3", user: "U1" },
      { text: "middle", ts: "2", user: "U2" },
      { text: "oldest: use A", ts: "1", user: "U1" },
    ];
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({ ok: true, messages: apiMessages }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const docs = await new SlackConnector("test-token").fetchDocs({ channels: ["C1"] });
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toBe("oldest: use A\nmiddle\nnewest: use B");
    expect(apiMessages.map((m) => m.text)).toEqual(["newest: use B", "middle", "oldest: use A"]);
  });
});
