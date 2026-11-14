import { describe, expect, it } from "vitest";
import { parseWebhook } from "../src/github/webhooks";

describe("R6-160 reopened PR", () => {
  it("emits check_pr for reopened action", () => {
    const payload = {
      installation: { id: 123 },
      action: "reopened",
      repository: { full_name: "acme/repo" },
      pull_request: { number: 42 },
    };
    const intents = parseWebhook("pull_request", payload);
    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: "check_pr",
      installationId: 123,
      fullName: "acme/repo",
      prNumber: 42,
    });
  });
});
