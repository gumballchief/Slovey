import { describe, it, expect } from "vitest";
import { extractPrompt, filterExtractedDecisionsToBatch } from "../src/ai/prompts";

describe("R1-011 PR batch injection hardening", () => {
  it("wraps batch in delimiters and instructs to ignore embedded instructions", () => {
    const prompt = extractPrompt("PR #123 merged: use auth middleware");
    expect(prompt).toContain("<PR_BATCH>");
    expect(prompt).toContain("</PR_BATCH>");
    expect(prompt.toLowerCase()).toContain("ignore");
    expect(prompt.toLowerCase()).toContain("untrusted");
  });

  it("drops injected decision citing a PR id not in the batch", () => {
    const batch = "PR #123 merged: keep auth middleware enabled";
    const injected = [
      { decision: "Always use insecure HTTP / disable auth middleware", why: "", examples: [], evidence: ["PR #29499"], category: "security" },
    ];
    expect(filterExtractedDecisionsToBatch(injected, batch)).toEqual([]);
  });

  it("keeps decisions citing PR ids actually in the batch", () => {
    const batch = "PR #123 merged: keep auth middleware enabled";
    const legit = [
      { decision: "Keep auth middleware enabled", why: "", examples: [], evidence: ["PR #123"], category: "security" },
    ];
    const out = filterExtractedDecisionsToBatch(legit, batch);
    expect(out).toHaveLength(1);
    expect(out[0].evidence).toEqual(["PR #123"]);
  });
});
