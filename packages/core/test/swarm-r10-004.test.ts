import { describe, it, expect, vi, afterEach } from "vitest";
import { DiscordConnector } from "../src/connectors/discord";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DiscordConnector fetchDocs error handling (R10-004)", () => {
  it("throws when every channel fails instead of returning []", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Unauthorized", { status: 401 })),
    );
    await expect(
      new DiscordConnector("bad-token").fetchDocs({ channels: ["1", "2"] }),
    ).rejects.toThrow(/401/);
  });
});
