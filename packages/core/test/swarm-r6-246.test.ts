import { describe, expect, it } from "vitest";
import { parseErrors } from "../src/preflight/parse";

describe("R6-246 fingerprint dedupe keeps distinct lines", () => {
  it("keeps identical TS errors at different lines", () => {
    const output = [
      "src/a.ts(10,5): error TS2532: Object is possibly 'undefined'.",
      "src/a.ts(99,5): error TS2532: Object is possibly 'undefined'.",
    ].join("\n");
    const errors = parseErrors("typecheck", output);
    expect(errors.length).toBe(2);
  });
});
