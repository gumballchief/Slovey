import { describe, expect, it } from "vitest";
import { capAgentIntent, MAX_INTENT_CHARS } from "../src/pipelines/agent";

describe("capAgentIntent", () => {
  it("caps a multi-megabyte intent to a bounded prompt-safe length", () => {
    const huge = "x".repeat(1_000_000);
    const capped = capAgentIntent(huge);
    expect(MAX_INTENT_CHARS).toBeGreaterThanOrEqual(2000);
    expect(MAX_INTENT_CHARS).toBeLessThanOrEqual(8000);
    expect(capped.length).toBe(MAX_INTENT_CHARS);
    expect(capped).toBe(huge.slice(0, MAX_INTENT_CHARS));
  });

  it("leaves short intents unchanged", () => {
    expect(capAgentIntent("add a health endpoint")).toBe("add a health endpoint");
    expect(capAgentIntent("")).toBe("");
  });
});
