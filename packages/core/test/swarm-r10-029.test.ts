import { describe, expect, it } from "vitest";
import {
  MAX_EXISTING_FILE_CHARS,
  isLargeExistingFile,
  isTruncatedReplacement,
} from "../src/pipelines/agent";

describe("R10-029 large file truncation guard", () => {
  it("flags an existing file over the char budget", () => {
    const big = "x".repeat(MAX_EXISTING_FILE_CHARS + 1);
    expect(isLargeExistingFile(big)).toBe(true);
  });

  it("allows small existing files and new files", () => {
    expect(isLargeExistingFile("small")).toBe(false);
    expect(isLargeExistingFile(null)).toBe(false);
  });

  it("rejects a replacement much shorter than the original", () => {
    const original = "a".repeat(10000);
    const prefix = "a".repeat(2000);
    expect(isTruncatedReplacement(original, prefix)).toBe(true);
  });

  it("allows a full-size replacement", () => {
    const original = "a".repeat(10000);
    const full = "b".repeat(9800);
    expect(isTruncatedReplacement(original, full)).toBe(false);
  });
});
