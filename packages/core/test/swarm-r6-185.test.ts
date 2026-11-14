import { describe, it, expect, vi } from "vitest";

vi.mock("@company-brain/db", () => ({
  getDb: vi.fn(),
  decisions: {},
  feedback: {},
  prChecks: {},
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => args,
  desc: (...args: unknown[]) => args,
}));

import { getDb } from "@company-brain/db";
import { recordFeedback } from "../src/pipelines/feedback";

describe("R6-185 unknown PR feedback", () => {
  it("throws instead of recording orphan feedback", async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "fb1" }]),
    };
    const fakeDb = {
      select: vi.fn(() => selectChain),
      insert: vi.fn(() => insertChain),
    };
    vi.mocked(getDb).mockReturnValue(fakeDb as unknown as never);

    await expect(
      recordFeedback({ repoId: "r1", prNumber: 999, action: "dismiss" })
    ).rejects.toThrow();
  });
});
