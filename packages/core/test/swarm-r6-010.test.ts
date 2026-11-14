import { describe, it, expect, vi, afterEach } from "vitest";
import { SlackConnector } from "../src/connectors/slack";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("slack per-channel errors", () => {
  it("re-throws auth errors instead of reporting success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        text: async () => "invalid_auth",
        json: async () => ({}),
      }))
    );
    const c = new SlackConnector("expired");
    await expect(c.fetchDocs({ channels: ["C1"] })).rejects.toThrow(/401|invalid_auth/);
  });

  it("still skips channels the bot is not in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({ ok: false, error: "not_in_channel" }),
      }))
    );
    const c = new SlackConnector("valid");
    await expect(c.fetchDocs({ channels: ["C1"] })).resolves.toEqual([]);
  });
});
