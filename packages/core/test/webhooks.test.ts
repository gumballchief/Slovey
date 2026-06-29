import { describe, expect, it } from "vitest";
import { parseWebhook } from "../src/github/webhooks";
import { COMMENT_MARKER, buildComment } from "../src/pipelines/comment";

describe("parseWebhook", () => {
  const base = { installation: { id: 42 }, repository: { full_name: "o/r" } };

  it("enqueues a check on pull_request opened", () => {
    const intents = parseWebhook("pull_request", {
      ...base,
      action: "opened",
      pull_request: { number: 7 },
    });
    expect(intents).toEqual([
      { type: "check_pr", installationId: 42, fullName: "o/r", prNumber: 7, action: "opened" },
    ]);
  });

  it("enqueues a check on synchronize", () => {
    const intents = parseWebhook("pull_request", {
      ...base,
      action: "synchronize",
      pull_request: { number: 7 },
    });
    expect(intents[0]?.type).toBe("check_pr");
  });

  it("ignores unrelated pull_request actions", () => {
    const intents = parseWebhook("pull_request", {
      ...base,
      action: "labeled",
      pull_request: { number: 7 },
    });
    expect(intents).toEqual([]);
  });

  it("turns '/brain dismiss' into a feedback intent", () => {
    const intents = parseWebhook("issue_comment", {
      ...base,
      action: "created",
      issue: { number: 7, pull_request: {} },
      comment: { body: "/brain dismiss not relevant here", user: { login: "alice" } },
    });
    expect(intents[0]).toMatchObject({ type: "feedback", action: "dismiss", byUser: "alice" });
  });

  it("ignores the bot's own comment (no self-dismiss loop)", () => {
    const intents = parseWebhook("issue_comment", {
      ...base,
      action: "created",
      issue: { number: 7, pull_request: {} },
      // The bot's own comment contains the instruction "reply `/brain dismiss`".
      comment: {
        body: "Heads up… If this is intentional, reply `/brain dismiss`.",
        user: { login: "company-brain-dev[bot]", type: "Bot" },
      },
    });
    expect(intents).toEqual([]);
  });

  it("does not match '/brain dismiss' embedded mid-comment", () => {
    const intents = parseWebhook("issue_comment", {
      ...base,
      action: "created",
      issue: { number: 7, pull_request: {} },
      comment: { body: "I think you can reply /brain dismiss to silence it", user: { login: "alice" } },
    });
    expect(intents).toEqual([]);
  });

  it("ignores events with no installation", () => {
    expect(parseWebhook("pull_request", { action: "opened" })).toEqual([]);
  });
});

describe("buildComment", () => {
  it("includes the citation and the dedupe marker", () => {
    const body = buildComment({
      explanation: "Adds render.yaml",
      decision: "No platform deploy configs",
      citation: "PR #29636",
      confidence: "high",
    });
    expect(body).toContain("PR #29636");
    expect(body).toContain("No platform deploy configs");
    expect(body).toContain(COMMENT_MARKER);
  });
});
