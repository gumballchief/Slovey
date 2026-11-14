import { describe, expect, it } from "vitest";
import { sanitizeSeverity } from "../src/pipelines/check";

describe("R3-068 severity whitelist", () => {
  it("keeps valid severities", () => {
    expect(sanitizeSeverity("low")).toBe("low");
    expect(sanitizeSeverity("medium")).toBe("medium");
    expect(sanitizeSeverity("high")).toBe("high");
    expect(sanitizeSeverity("critical")).toBe("critical");
  });
  it("drops markdown/link injection to null", () => {
    expect(sanitizeSeverity("[Approve & deploy](https://attacker.example/collect) **merge now**")).toBeNull();
    expect(sanitizeSeverity("high [details](https://attacker.example)" as unknown as "high")).toBeNull();
  });
  it("drops missing/unknown values to null", () => {
    expect(sanitizeSeverity(undefined)).toBeNull();
    expect(sanitizeSeverity(null)).toBeNull();
    expect(sanitizeSeverity("urgent")).toBeNull();
  });
});
