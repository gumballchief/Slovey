import { beforeEach, describe, expect, it, vi } from "vitest";
import { canI } from "../src/api/can-i";
import { getRejectedKnowledge } from "../src/api/rejected";
import { plan } from "../src/planning/engine";

vi.mock("../src/ai", () => ({
  getAI: () => ({ completeJSON: async () => null }),
}));
vi.mock("../src/api/can-i", () => ({ canI: vi.fn() }));
vi.mock("../src/api/rejected", () => ({ getRejectedKnowledge: vi.fn() }));
vi.mock("../src/reasoning/context", () => ({ contextForScope: vi.fn(async () => null) }));

const rejectedRow = (distance: number) => ({
  id: "r1",
  decision: "Use SOAP for internal billing sync",
  rejectionReason: "too brittle",
  alternatives: ["REST"],
  evidence: [],
  createdAt: "2024-01-01T00:00:00.000Z",
  distance,
});

beforeEach(() => {
  vi.mocked(canI).mockResolvedValue({
    intent: "add a dashboard widget",
    verdict: "unclear",
    rationale: "No recorded engineering decision addresses this.",
    citations: [],
    rejectedPrecedent: [],
  });
});

describe("R10-201: unrelated rejected decisions are not precedent", () => {
  it("ignores a far-away rejected decision for an unrelated request", async () => {
    vi.mocked(getRejectedKnowledge).mockResolvedValue([rejectedRow(0.95)]);
    const result = await plan("repo-1", "add a dashboard widget");
    expect(result.rejectedPrecedent).toEqual([]);
    expect(result.conflicts).toEqual([]);
    expect(result.risk).not.toBe("high");
  });

  it("still surfaces a semantically close rejected decision", async () => {
    vi.mocked(getRejectedKnowledge).mockResolvedValue([rejectedRow(0.2)]);
    const result = await plan("repo-1", "add a dashboard widget");
    expect(result.rejectedPrecedent).toHaveLength(1);
    expect(result.conflicts[0]).toContain("Previously rejected");
  });
});
