import { describe, it, expect, vi } from "vitest";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: () => "null",
  };
});

import { loadPreflightConfig } from "../src/preflight/config";
import { DEFAULT_CONFIG } from "../src/preflight/types";

describe("R10-210 null config fallback", () => {
  it("does not crash on JSON null and falls back to defaults", () => {
    let result: ReturnType<typeof loadPreflightConfig> | undefined;
    expect(() => {
      result = loadPreflightConfig("/fake/cwd");
    }).not.toThrow();
    expect(result?.warning).toBeDefined();
    expect(result?.config.decisionChecks).toEqual(DEFAULT_CONFIG.decisionChecks);
    expect(result?.config.requiredChecks).toEqual(DEFAULT_CONFIG.requiredChecks);
  });
});
