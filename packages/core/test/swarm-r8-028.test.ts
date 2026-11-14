import { describe, expect, it } from "vitest";
import { hasHeadChanged } from "../src/pipelines/check";

describe("R8-028 stale headSha guard", () => {
  it("detects when the PR head moved during the judge", () => {
    expect(hasHeadChanged("aaa111", "bbb222")).toBe(true);
  });

  it("does not flag an unchanged head", () => {
    expect(hasHeadChanged("aaa111", "aaa111")).toBe(false);
  });
});
