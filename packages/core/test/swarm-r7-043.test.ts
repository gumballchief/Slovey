import { describe, expect, it } from "vitest";
import { parseWebhook } from "../src/github/webhooks";

function prPayload(action: string, extra: Record<string, unknown> = {}) {
  return {
    installation: { id: 42 },
    action,
    repository: { full_name: "acme/widgets" },
    pull_request: { number: 7, base: { ref: "main" } },
    ...extra,
  };
}

describe("pull_request re-check triggers", () => {
  it("enqueues check_pr as synchronize on ready_for_review", () => {
    expect(parseWebhook("pull_request", prPayload("ready_for_review"))).toEqual([
      { type: "check_pr", installationId: 42, fullName: "acme/widgets", prNumber: 7, action: "synchronize" },
    ]);
  });

  it("enqueues check_pr as synchronize on edited when the base changed", () => {
    const payload = prPayload("edited", { changes: { base: { ref: { from: "dev" }, sha: { from: "abc" } } } });
    expect(parseWebhook("pull_request", payload)).toEqual([
      { type: "check_pr", installationId: 42, fullName: "acme/widgets", prNumber: 7, action: "synchronize" },
    ]);
  });

  it("does not enqueue check_pr on edited without a base change", () => {
    const payload = prPayload("edited", { changes: { title: { from: "old title" } } });
    expect(parseWebhook("pull_request", payload)).toEqual([]);
  });
});
