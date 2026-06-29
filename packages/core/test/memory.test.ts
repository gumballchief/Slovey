import { describe, expect, it } from "vitest";
import { authorityRank, classifyMemory, memoryScore, type Scorable } from "../src/memory/score";

const now = new Date();
const base: Scorable = {
  status: "approved",
  confidence: 0.8,
  review: "unreviewed",
  updatedAt: now,
  now,
  source: "github_pr",
  importance: "medium",
  evidence: ["PR #1"],
};

describe("authorityRank", () => {
  it("orders human > engineering > docs > inferred > chat", () => {
    expect(authorityRank("manual")).toBeGreaterThan(authorityRank("github_pr"));
    expect(authorityRank("github_pr")).toBeGreaterThan(authorityRank("doc"));
    expect(authorityRank("doc")).toBeGreaterThan(authorityRank("repo_analysis"));
    expect(authorityRank("repo_analysis")).toBeGreaterThan(authorityRank("slack"));
  });
  it("defaults unknown sources to the middle", () => {
    expect(authorityRank("???")).toBe(0.5);
  });
});

describe("memoryScore", () => {
  it("is zero for retired/rejected memories", () => {
    expect(memoryScore({ ...base, status: "superseded" })).toBe(0);
    expect(memoryScore({ ...base, status: "rejected" })).toBe(0);
  });

  it("rewards higher authority", () => {
    const high = memoryScore({ ...base, source: "manual" });
    const low = memoryScore({ ...base, source: "slack" });
    expect(high).toBeGreaterThan(low);
  });

  it("rewards more evidence and higher importance", () => {
    expect(memoryScore({ ...base, evidence: ["a", "b", "c"] })).toBeGreaterThan(
      memoryScore({ ...base, evidence: [] }),
    );
    expect(memoryScore({ ...base, importance: "critical" })).toBeGreaterThan(
      memoryScore({ ...base, importance: "low" }),
    );
  });

  it("decays with age (a year-old decision scores lower)", () => {
    const old = memoryScore({ ...base, updatedAt: new Date(now.getTime() - 730 * 86_400_000) });
    expect(old).toBeLessThan(memoryScore(base));
  });

  it("stays within 0..1", () => {
    const s = memoryScore({ ...base, confidence: 1, importance: "critical", source: "manual", evidence: ["a", "b", "c", "d"] });
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});

describe("classifyMemory", () => {
  it("flags weak memories (low confidence, no evidence) as false-memory candidates", () => {
    const f = classifyMemory({ ...base, confidence: 0.3, evidence: [] });
    expect(f.weak).toBe(true);
  });

  it("flags stale memories (active but decayed)", () => {
    const f = classifyMemory({ ...base, confidence: 0.5, updatedAt: new Date(now.getTime() - 1500 * 86_400_000) });
    expect(f.stale).toBe(true);
  });

  it("puts critical/high importance in long_term, candidates in short_term", () => {
    expect(classifyMemory({ ...base, importance: "critical" }).layer).toBe("long_term");
    expect(classifyMemory({ ...base, status: "candidate" }).layer).toBe("short_term");
    expect(classifyMemory({ ...base, importance: "medium", status: "approved" }).layer).toBe("working");
  });

  it("marks a strong, fresh, well-evidenced memory durable", () => {
    const f = classifyMemory({ ...base, source: "manual", importance: "high", confidence: 0.95, evidence: ["a", "b", "c"] });
    expect(f.durable).toBe(true);
  });
});
