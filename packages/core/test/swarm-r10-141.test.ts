import { describe, expect, it } from "vitest";
import type { InstallationOctokit } from "../src/github/app";
import { findBotComment } from "../src/github/fetchers";

type FakeComment = { id: number; body: string; login: string; type: string };

function makeOctokit(pages: FakeComment[][]): InstallationOctokit {
  return {
    rest: {
      issues: {
        listComments: async (params: { page?: number }) => {
          const page = params.page ?? 1;
          const items = pages[page - 1] ?? [];
          return {
            data: items.map((c) => ({
              id: c.id,
              body: c.body,
              user: { login: c.login, type: c.type },
            })),
          };
        },
      },
    },
  } as unknown as InstallationOctokit;
}

describe("findBotComment", () => {
  it("finds the bot comment beyond the first page", async () => {
    const filler: FakeComment[] = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      body: "unrelated chatter",
      login: "alice",
      type: "User",
    }));
    const bot: FakeComment = {
      id: 999,
      body: "hello MARKER-141 world",
      login: "slovey[bot]",
      type: "Bot",
    };
    const octokit = makeOctokit([filler, [bot]]);
    const found = await findBotComment(octokit, "o", "r", 1, "MARKER-141");
    expect(found).toBe(999);
  });

  it("ignores a human quoting the marker and returns the bot comment", async () => {
    const octokit = makeOctokit([
      [
        { id: 11, body: "quoting MARKER-141 here", login: "alice", type: "User" },
        { id: 22, body: "real MARKER-141 verdict", login: "slovey[bot]", type: "Bot" },
      ],
    ]);
    const found = await findBotComment(octokit, "o", "r", 1, "MARKER-141");
    expect(found).toBe(22);
  });
});
