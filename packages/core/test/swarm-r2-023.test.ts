import { describe, it, expect, vi, afterEach } from "vitest";
import { SlackConnector } from "../src/connectors/slack";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("slack channel cap R2-023", () => {
  it("caps configured channels to bound API calls and memory", async () => {
    const ids = Array.from({ length: 100 }, (_, i) => `C${i}`);
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      return {
        ok: true,
        json: async () => ({ ok: true, messages: [{ text: "hello" }] }),
        text: async () => "",
      } as unknown as Response;
    });
    const c = new SlackConnector("xoxb-test");
    const docs = await c.fetchDocs({ channels: ids });
    expect(docs.length).toBeLessThanOrEqual(20);
    expect(calls).toBeLessThanOrEqual(20);
  });
});
