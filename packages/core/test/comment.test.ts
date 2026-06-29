import { describe, expect, it } from "vitest";
import { buildComment, buildResolvedComment, COMMENT_MARKER } from "../src/pipelines/comment";

describe("buildComment", () => {
  it("carries decision, citation, severity, and the hidden marker", () => {
    const body = buildComment({
      explanation: "Adds a fly.toml deploy config",
      decision: "No platform deploy configs",
      citation: "PR #29636",
      confidence: "high",
      severity: "high",
      suggestedFix: "Remove fly.toml",
    });
    expect(body).toContain("No platform deploy configs");
    expect(body).toContain("PR #29636");
    expect(body).toContain("🔴 High");
    expect(body).toContain("Remove fly.toml");
    expect(body).toContain(COMMENT_MARKER);
  });
});

describe("buildResolvedComment", () => {
  it("explains a dismissal and keeps the marker (so re-checks still find it)", () => {
    const body = buildResolvedComment("decision-dismissed");
    expect(body).toContain("Resolved");
    expect(body).toContain("dismissed");
    expect(body).toContain(COMMENT_MARKER);
  });

  it("explains a fixed PR for other clear reasons", () => {
    const body = buildResolvedComment("no-conflict");
    expect(body).toContain("Resolved");
    expect(body).toContain("no longer conflicts");
    expect(body).toContain(COMMENT_MARKER);
  });
});
