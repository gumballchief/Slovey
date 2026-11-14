import { describe, expect, it } from "vitest";
import {
  extractQueryKeywords,
  unionDecisionPools,
} from "../src/pipelines/retrieve";

describe("R5-073 embedding-stuffing backstop", () => {
  it("keeps the violating payments term despite benign stuffing", () => {
    const pr = {
      title: "payments checkout validation bypass fix",
      body: "touches payments checkout validation ui-cosmetic docs logging polish",
      changedFiles: ["src/payments/checkout.ts", "docs/readme.md"],
      diffSummary: "payments checkout validation ui-cosmetic docs logging",
    };
    const kw = extractQueryKeywords(pr);
    expect(kw).toContain("payments");
  });

  it("unions an evicted violating decision back into the pool", () => {
    const benign = Array.from({ length: 8 }, (_, i) => ({ id: `benign-${i}` }));
    const violating = { id: "payments-security" };
    // Simulates cosine pool diluted by stuffing (violating ranked out),
    // plus a category/keyword backstop pool containing it.
    const merged = unionDecisionPools(benign, [violating]);
    expect(merged.map((r) => r.id)).toContain("payments-security");
    expect(merged).toHaveLength(9);
  });
});
