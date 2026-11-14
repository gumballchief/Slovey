import { describe, expect, it } from "vitest";
import { parseWebhook } from "../src/github/webhooks";

function commentPayload(author_association: string | undefined, body = "/brain dismiss") {
  return {
    installation: { id: 123 },
    action: "created",
    issue: { number: 7, pull_request: {} },
    comment: {
      body,
      user: { login: "mallory", type: "User" },
      author_association,
    },
    repository: { full_name: "acme/repo" },
  };
}

describe("R2-030 comment permission gate", () => {
  it("ignores /brain dismiss from comment-only (NONE) user", () => {
    expect(parseWebhook("issue_comment", commentPayload("NONE"))).toEqual([]);
  });
  it("ignores /brain confirm from contributor without write access", () => {
    expect(parseWebhook("issue_comment", commentPayload("CONTRIBUTOR", "/brain confirm"))).toEqual([]);
  });
  it("still accepts /brain dismiss from a privileged member", () => {
    const intents = parseWebhook("issue_comment", commentPayload("MEMBER"));
    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({ type: "feedback", action: "dismiss", byUser: "mallory" });
  });
});
