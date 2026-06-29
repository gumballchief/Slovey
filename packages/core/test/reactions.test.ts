import { describe, expect, it } from "vitest";
import { pickDownvoters } from "../src/pipelines/reactions";

describe("pickDownvoters", () => {
  it("returns distinct non-bot users who reacted 👎", () => {
    const users = pickDownvoters([
      { content: "-1", user: { login: "alice", type: "User" } },
      { content: "-1", user: { login: "alice", type: "User" } }, // dup
      { content: "+1", user: { login: "bob", type: "User" } }, // 👍 ignored
      { content: "-1", user: { login: "carol", type: "User" } },
    ]);
    expect(users.sort()).toEqual(["alice", "carol"]);
  });

  it("ignores the bot's own 👎 (no self-dismiss loop)", () => {
    expect(
      pickDownvoters([
        { content: "-1", user: { login: "company-brain[bot]", type: "Bot" } },
        { content: "-1", user: { login: "ci[bot]" } },
      ]),
    ).toEqual([]);
  });

  it("returns nothing when there are no 👎 reactions", () => {
    expect(pickDownvoters([{ content: "heart", user: { login: "dave", type: "User" } }])).toEqual([]);
  });
});
