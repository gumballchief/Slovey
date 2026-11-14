import { describe, expect, it } from "vitest";
import { fingerprint, parseErrors } from "../src/preflight/parse";

describe("R6-243: fingerprint/dedupe includes line and column", () => {
  it("keeps same code+message at two different lines", () => {
    const output = [
      "src/x.ts(12,5): error TS2532: Object is possibly 'undefined'.",
      "src/x.ts(40,5): error TS2532: Object is possibly 'undefined'.",
    ].join("\n");
    const errors = parseErrors("typecheck", output);
    expect(errors).toHaveLength(2);
    expect(errors[0]!.id).not.toBe(errors[1]!.id);
  });

  it("gives different fingerprints for different locations", () => {
    const a = fingerprint({ file: "src/x.ts", code: "TS2532", message: "Object is possibly 'undefined'.", line: 12, column: 5 });
    const b = fingerprint({ file: "src/x.ts", code: "TS2532", message: "Object is possibly 'undefined'.", line: 40, column: 5 });
    expect(a).not.toBe(b);
  });
});
