import { describe, expect, it } from "vitest";
import {
  capCurrentForPrompt,
  isLargeExistingFile,
  isTruncatedReplacement,
  MAX_EXISTING_FILE_CHARS,
} from "../src/pipelines/agent";

describe("agent current-file prompt budget", () => {
  it("caps huge current file content to the prompt budget", () => {
    const huge = "x".repeat(MAX_EXISTING_FILE_CHARS * 3);
    const capped = capCurrentForPrompt(huge);
    expect(capped.length).toBe(MAX_EXISTING_FILE_CHARS);
    expect(capped).toBe(huge.slice(0, MAX_EXISTING_FILE_CHARS));
  });

  it("leaves small current file content unchanged", () => {
    expect(capCurrentForPrompt("const a = 1;\n")).toBe("const a = 1;\n");
  });

  it("flags files over the budget and truncated replacements", () => {
    const huge = "x".repeat(MAX_EXISTING_FILE_CHARS + 1);
    expect(isLargeExistingFile(huge)).toBe(true);
    expect(isLargeExistingFile("small")).toBe(false);
    expect(isTruncatedReplacement(huge, "short")).toBe(true);
  });
});
