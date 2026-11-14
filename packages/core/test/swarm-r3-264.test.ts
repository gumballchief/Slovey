import { describe, expect, it } from "vitest";
import { pickDownvoters, pickFreshDownvoters } from "../src/pipelines/reactions";

describe("R3-264 stale 👎 must not poison later checks", () => {
  const checkedAt = "2024-05-02T12:00:00.000Z";
  const stale = {
    content: "-1",
    created_at: "2024-05-01T12:00:00.000Z",
    author_association: "MEMBER",
    user: { login: "alice", type: "User" },
  };
  const fresh = {
    content: "-1",
    created_at: "2024-05-03T12:00:00.000Z",
    author_association: "MEMBER",
    user: { login: "alice", type: "User" },
  };

  it("ignores 👎 created before the latest check", () => {
    // Old path sees the stale voter (the bug: it would dismiss the new check).
    expect(pickDownvoters([stale])).toEqual(["alice"]);
    // Fixed path drops it because reaction time <= check.checkedAt.
    expect(pickFreshDownvoters([stale], checkedAt)).toEqual([]);
  });

  it("keeps 👎 created after the latest check", () => {
    expect(pickFreshDownvoters([fresh], checkedAt)).toEqual(["alice"]);
    expect(pickFreshDownvoters([stale, fresh], checkedAt)).toEqual(["alice"]);
  });
});
