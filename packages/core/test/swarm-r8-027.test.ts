import { describe, expect, it } from "vitest";
import { sanitizeDecisionForComment } from "../src/pipelines/check";
import { buildComment } from "../src/pipelines/comment";

describe("R8-027: decision/citation sanitized before trusted bot comment", () => {
  it("strips phishing links and tracking images from decision text", () => {
    const evil = "[Approve & merge](https://evil.example/phish) @org/team ![x](https://evil.example/track)";
    const clean = sanitizeDecisionForComment(evil);
    expect(clean).not.toContain("evil.example");
    expect(clean).not.toContain("](");
    expect(clean).toContain("Approve & merge");
  });

  it("sanitized decision/citation render safely in buildComment", () => {
    const evilDecision = "[Approve & merge](https://evil.example/phish) ![x](https://evil.example/track)";
    const evilCitation = "PR #123, https://evil.example/track";
    const body = buildComment({
      explanation: "conflicts",
      decision: sanitizeDecisionForComment(evilDecision),
      citation: sanitizeDecisionForComment(evilCitation),
      confidence: "high",
    });
    expect(body).not.toContain("evil.example");
    expect(body).not.toContain("](");
  });
});
